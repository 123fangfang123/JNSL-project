'use client'
import { useEffect } from 'react'

interface NavigationGuardProps {
  active: boolean
  message?: string
}

export function NavigationGuard({ active, message = '订单正在导入中，确定要离开吗？' }: NavigationGuardProps) {
  useEffect(() => {
    if (!active) return

    const handleClick = (e: MouseEvent) => {
      // Find the closest anchor element
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      
      if (anchor && anchor.href) {
        // Check if it's an internal link (same origin)
        const isInternal = anchor.origin === window.location.origin
        
        if (isInternal) {
          const confirmed = window.confirm(message)
          if (!confirmed) {
            e.preventDefault()
            e.stopPropagation()
            return false
          }
        }
      }
    }

    // Add click listener to document
    document.addEventListener('click', handleClick, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [active, message])

  return null
}