import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  })

  // Calculate date 1 month ago - use UTC to match PostgreSQL's CURRENT_DATE behavior
  const now = new Date()
  const oneMonthAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate()))
  const dateStr = oneMonthAgo.toISOString().split('T')[0]

  try {
    const BATCH_SIZE = 1000
    
    // Step 1: Get all shipped orders older than 1 month (matching SQL WHERE clause)
    const allShippedOrders: Array<{
      transaction_id: string
      order_number: string
      dispatch_date: string
      order_status: string
      store_name: string
    }> = []
    let hasMoreOrders = true
    let ordersOffset = 0

    while (hasMoreOrders) {
      const { data: batchOrders, error: ordersError } = await supabase
        .from('orders')
        .select('transaction_id, order_number, dispatch_date, order_status, store_name')
        .eq('order_status', 'shipped')
        .lt('dispatch_date', dateStr)
        .range(ordersOffset, ordersOffset + BATCH_SIZE - 1)

      if (ordersError) {
        throw new Error(`Failed to fetch orders: ${ordersError.message}`)
      }

      if (!batchOrders || batchOrders.length === 0) {
        hasMoreOrders = false
      } else {
        allShippedOrders.push(...batchOrders)
        if (batchOrders.length < BATCH_SIZE) {
          hasMoreOrders = false
        } else {
          ordersOffset += BATCH_SIZE
        }
      }
    }

    if (allShippedOrders.length === 0) {
      return Response.json({ data: [], total: 0, page, pageSize })
    }

    const allTransactionIds = allShippedOrders.map(o => o.transaction_id)

    // Step 2: Get all shipment records for these orders
    const allShipments: Array<{ transaction_id: string; tracking_no: string | null; dest_tracking: string | null }> = []
    
    for (let i = 0; i < allTransactionIds.length; i += BATCH_SIZE) {
      const batch = allTransactionIds.slice(i, i + BATCH_SIZE)
      
      const { data: batchShipments, error: shipmentsError } = await supabase
        .from('order_shipment')
        .select('transaction_id, tracking_no, dest_tracking')
        .in('transaction_id', batch)

      if (shipmentsError) {
        throw new Error(`Failed to fetch shipment details: ${shipmentsError.message}`)
      }

      if (batchShipments) {
        allShipments.push(...batchShipments)
      }
    }

    // Build shipment map
    const shipmentMap = new Map<string, Array<{ tracking_no: string | null; dest_tracking: string | null }>>()
    for (const shipment of allShipments) {
      const tid = shipment.transaction_id
      if (!shipmentMap.has(tid)) {
        shipmentMap.set(tid, [])
      }
      shipmentMap.get(tid)!.push({
        tracking_no: shipment.tracking_no,
        dest_tracking: shipment.dest_tracking,
      })
    }

    // Step 3: Filter orders based on SQL logic
    const filteredResults: Array<{
      transaction_id: string
      order_number: string
      dispatch_date: string
      order_status: string
      store_name: string
      tracking_no: string | null
      dest_tracking: string | null
    }> = []

    let case1Count = 0
    let case2Count = 0

    for (const order of allShippedOrders) {
      const ships = shipmentMap.get(order.transaction_id)
      
      if (!ships || ships.length === 0) {
        // Case 2: No shipment record at all
        case2Count++
        filteredResults.push({
          transaction_id: order.transaction_id,
          order_number: order.order_number,
          dispatch_date: order.dispatch_date,
          order_status: order.order_status,
          store_name: order.store_name,
          tracking_no: null,
          dest_tracking: null,
        })
      } else {
        // Check if any shipment has empty dest_tracking (Case 1)
        const hasEmptyDestTracking = ships.some(s => !s.dest_tracking || s.dest_tracking === '')
        
        if (hasEmptyDestTracking) {
          case1Count++
          const firstShip = ships.find(s => !s.dest_tracking || s.dest_tracking === '') || ships[0]
          
          filteredResults.push({
            transaction_id: order.transaction_id,
            order_number: order.order_number,
            dispatch_date: order.dispatch_date,
            order_status: order.order_status,
            store_name: order.store_name,
            tracking_no: firstShip.tracking_no,
            dest_tracking: firstShip.dest_tracking,
          })
        }
      }
    }

    // Apply pagination
    const total = filteredResults.length
    const from = (page - 1) * pageSize
    const to = from + pageSize
    const paginatedData = filteredResults.slice(from, to)

    return Response.json({ 
      data: paginatedData, 
      total, 
      page, 
      pageSize,
      debug: {
        case1Count,
        case2Count,
        totalCount: total,
        totalShippedOrders: allShippedOrders.length
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `查询失败：${errorMessage}` }, { status: 500 })
  }
}
