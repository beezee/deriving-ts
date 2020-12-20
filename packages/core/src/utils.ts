export const absurd = <A>(x: never): A => (null as unknown as A)

export const memo = (cache: Record<string, any>) => <A>(i: string, fn: () => A): A => {
  if (i in cache) return (cache[i] as A)
  const result = fn()
  if (i in cache) return (cache[i] as A)
  cache[i] = result
  return result
}
