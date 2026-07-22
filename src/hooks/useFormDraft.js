import { useCallback, useEffect, useRef, useState } from 'react'

const DRAFT_KEY = 'childkeeper_form_draft_loghours'
const DEBOUNCE_MS = 500

export function useFormDraft(formData, defaultFormData, isDataLoaded = true) {
  const debounceTimer = useRef(null)
  const [hasDraft, setHasDraft] = useState(false)

  // On mount, check for saved draft
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setHasDraft(true)
      } catch (e) {
        console.error('Failed to parse saved draft:', e)
        window.localStorage.removeItem(DRAFT_KEY)
      }
    }
  }, [])

  // Debounced auto-save (only when data is loaded)
  const saveDraft = useCallback(() => {
    if (!isDataLoaded) {
      return
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      try {
        const serialized = JSON.stringify(formData)
        window.localStorage.setItem(DRAFT_KEY, serialized)
      } catch (e) {
        console.error('Failed to save draft:', e)
      }
    }, DEBOUNCE_MS)
  }, [formData, isDataLoaded])

  // Restore draft
  const restoreDraft = useCallback(() => {
    if (typeof window === 'undefined') return null
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed
      }
      return null
    } catch (e) {
      console.error('Failed to restore draft:', e)
      return null
    }
  }, [])

  // Clear draft after successful save
  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(DRAFT_KEY)
    setHasDraft(false)
  }, [])

  return {
    hasDraft,
    saveDraft,
    restoreDraft,
    clearDraft,
  }
}
