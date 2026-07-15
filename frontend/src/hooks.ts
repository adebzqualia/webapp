import { useCallback, useEffect, useState, type DependencyList } from 'react'

export interface AsyncResource<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  setData: React.Dispatch<React.SetStateAction<T | null>>
}

export function useAsyncResource<T>(loader: () => Promise<T>, dependencies: DependencyList): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Une erreur inattendue est survenue.')
    } finally {
      setLoading(false)
    }
    // The caller controls when its loader changes through dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload, setData }
}
