import {
  debounce,
  throttle,
  addResourceHints,
  createIntersectionObserver,
} from '../performance-optimizer'

beforeEach(() => {
  jest.useRealTimers()
})

describe('performance optimizer helpers', () => {
  it('debounce waits for idle period before invoking function', () => {
    jest.useFakeTimers()
    const spy = jest.fn()
    const debounced = debounce(spy, 200)

    debounced('first')
    debounced('second')

    expect(spy).not.toHaveBeenCalled()

    jest.advanceTimersByTime(199)
    expect(spy).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('second')
  })

  it('throttle limits execution frequency', () => {
    jest.useFakeTimers()
    const spy = jest.fn()
    const throttled = throttle(spy, 100)

    throttled('a')
    throttled('b')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('a')

    jest.advanceTimersByTime(100)
    throttled('c')
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith('c')
  })

  it('adds resource hint links to the document head', () => {
    const appendSpy = jest.spyOn(document.head, 'appendChild')

    addResourceHints([
      { href: '/font.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
    ])

    expect(appendSpy).toHaveBeenCalledTimes(1)
    const link = appendSpy.mock.calls[0][0] as HTMLLinkElement
    expect(link.rel).toBe('preload')
    expect(link.href).toContain('/font.woff2')
    expect(link.as).toBe('font')

    appendSpy.mockRestore()
  })

  it('returns null when IntersectionObserver is unavailable', () => {
    const originalGlobal = (globalThis as any).IntersectionObserver
    const originalWindow = (window as any).IntersectionObserver
    delete (globalThis as any).IntersectionObserver
    delete (window as any).IntersectionObserver

    const observer = createIntersectionObserver(() => undefined)
    expect(observer).toBeNull()

    if (originalGlobal) {
      (globalThis as any).IntersectionObserver = originalGlobal
    }
    if (originalWindow) {
      (window as any).IntersectionObserver = originalWindow
    }
  })
})
