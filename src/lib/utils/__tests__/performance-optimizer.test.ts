import {
  optimizeBundle,
  preloadCriticalResources,
  measurePerformance,
  optimizeImages,
  cacheStrategy,
  debounce,
  throttle,
  memoize
} from '../performance-optimizer'

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true,
})

describe('Performance Optimizer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('optimizeBundle', () => {
    it('should identify large chunks', () => {
      const bundleStats = {
        chunks: [
          { name: 'main', size: 500000 },
          { name: 'vendor', size: 1500000 },
          { name: 'component', size: 100000 },
        ],
        assets: [
          { name: 'main.js', size: 500000 },
          { name: 'vendor.js', size: 1500000 },
        ],
      }

      const result = optimizeBundle(bundleStats)

      expect(result.largeChunks).toHaveLength(1)
      expect(result.largeChunks[0].name).toBe('vendor')
      expect(result.recommendations).toContain('code splitting')
    })

    it('should suggest optimizations for large bundles', () => {
      const bundleStats = {
        chunks: [{ name: 'main', size: 2000000 }],
        assets: [{ name: 'main.js', size: 2000000 }],
      }

      const result = optimizeBundle(bundleStats)

      expect(result.recommendations).toContain('tree shaking')
      expect(result.recommendations).toContain('dynamic imports')
    })

    it('should handle empty bundle stats', () => {
      const bundleStats = { chunks: [], assets: [] }
      const result = optimizeBundle(bundleStats)

      expect(result.largeChunks).toHaveLength(0)
      expect(result.totalSize).toBe(0)
    })
  })

  describe('preloadCriticalResources', () => {
    it('should create preload links for critical resources', () => {
      const resources = [
        { url: '/api/user', type: 'fetch' as const, priority: 'high' as const },
        { url: '/fonts/main.woff2', type: 'font' as const, priority: 'high' as const },
        { url: '/css/critical.css', type: 'style' as const, priority: 'high' as const },
      ]

      // Mock document.head
      const mockHead = {
        appendChild: jest.fn(),
      }
      Object.defineProperty(document, 'head', {
        value: mockHead,
        writable: true,
      })

      preloadCriticalResources(resources)

      expect(mockHead.appendChild).toHaveBeenCalledTimes(3)
    })

    it('should handle different resource types correctly', () => {
      const resources = [
        { url: '/image.jpg', type: 'image' as const, priority: 'low' as const },
        { url: '/script.js', type: 'script' as const, priority: 'medium' as const },
      ]

      const mockHead = {
        appendChild: jest.fn(),
      }
      Object.defineProperty(document, 'head', {
        value: mockHead,
        writable: true,
      })

      preloadCriticalResources(resources)

      expect(mockHead.appendChild).toHaveBeenCalledTimes(2)
    })
  })

  describe('measurePerformance', () => {
    it('should measure operation performance', async () => {
      const operation = jest.fn().mockResolvedValue('result')
      mockPerformance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1500)

      const result = await measurePerformance('test-operation', operation)

      expect(result.result).toBe('result')
      expect(result.duration).toBe(500)
      expect(result.operation).toBe('test-operation')
      expect(mockPerformance.mark).toHaveBeenCalledWith('test-operation-start')
      expect(mockPerformance.mark).toHaveBeenCalledWith('test-operation-end')
    })

    it('should handle operation errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'))
      mockPerformance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1200)

      await expect(measurePerformance('test-operation', operation)).rejects.toThrow('Test error')
      expect(mockPerformance.mark).toHaveBeenCalledWith('test-operation-start')
      expect(mockPerformance.mark).toHaveBeenCalledWith('test-operation-end')
    })
  })

  describe('optimizeImages', () => {
    it('should generate optimized image configurations', () => {
      const images = [
        { src: '/image1.jpg', width: 1920, height: 1080 },
        { src: '/image2.png', width: 800, height: 600 },
      ]

      const result = optimizeImages(images)

      expect(result).toHaveLength(2)
      expect(result[0].formats).toContain('webp')
      expect(result[0].sizes).toContain('1920w')
      expect(result[1].formats).toContain('webp')
    })

    it('should suggest appropriate formats for different image types', () => {
      const images = [
        { src: '/photo.jpg', width: 1200, height: 800 },
        { src: '/icon.png', width: 64, height: 64 },
        { src: '/logo.svg', width: 200, height: 100 },
      ]

      const result = optimizeImages(images)

      expect(result[0].formats).toContain('webp')
      expect(result[1].formats).toContain('webp')
      expect(result[2].formats).toEqual(['svg']) // SVG should remain as-is
    })
  })

  describe('cacheStrategy', () => {
    it('should determine appropriate cache strategies', () => {
      const resources = [
        { url: '/api/data', type: 'api' as const, changeFrequency: 'high' as const },
        { url: '/static/image.jpg', type: 'static' as const, changeFrequency: 'never' as const },
        { url: '/css/styles.css', type: 'css' as const, changeFrequency: 'low' as const },
      ]

      const result = cacheStrategy(resources)

      expect(result[0].strategy).toBe('no-cache')
      expect(result[1].strategy).toBe('cache-first')
      expect(result[2].strategy).toBe('stale-while-revalidate')
    })

    it('should set appropriate cache durations', () => {
      const resources = [
        { url: '/static/font.woff2', type: 'font' as const, changeFrequency: 'never' as const },
        { url: '/api/user', type: 'api' as const, changeFrequency: 'medium' as const },
      ]

      const result = cacheStrategy(resources)

      expect(result[0].maxAge).toBeGreaterThan(result[1].maxAge)
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      const fn = jest.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('arg1')
      debouncedFn('arg2')
      debouncedFn('arg3')

      expect(fn).not.toHaveBeenCalled()

      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn).toHaveBeenCalledWith('arg3')
        done()
      }, 150)
    })

    it('should handle immediate execution option', () => {
      const fn = jest.fn()
      const debouncedFn = debounce(fn, 100, true)

      debouncedFn('arg1')
      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('arg1')

      debouncedFn('arg2')
      expect(fn).toHaveBeenCalledTimes(1) // Should not call again immediately
    })
  })

  describe('throttle', () => {
    it('should throttle function calls', (done) => {
      const fn = jest.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn('arg1')
      throttledFn('arg2')
      throttledFn('arg3')

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('arg1')

      setTimeout(() => {
        throttledFn('arg4')
        expect(fn).toHaveBeenCalledTimes(2)
        expect(fn).toHaveBeenCalledWith('arg4')
        done()
      }, 150)
    })
  })

  describe('memoize', () => {
    it('should cache function results', () => {
      const expensiveFn = jest.fn((x: number) => x * 2)
      const memoizedFn = memoize(expensiveFn)

      const result1 = memoizedFn(5)
      const result2 = memoizedFn(5)
      const result3 = memoizedFn(10)

      expect(result1).toBe(10)
      expect(result2).toBe(10)
      expect(result3).toBe(20)
      expect(expensiveFn).toHaveBeenCalledTimes(2) // Only called for unique arguments
    })

    it('should handle complex arguments', () => {
      const fn = jest.fn((obj: { a: number; b: string }) => `${obj.a}-${obj.b}`)
      const memoizedFn = memoize(fn)

      const arg1 = { a: 1, b: 'test' }
      const arg2 = { a: 1, b: 'test' }
      const arg3 = { a: 2, b: 'test' }

      memoizedFn(arg1)
      memoizedFn(arg2)
      memoizedFn(arg3)

      expect(fn).toHaveBeenCalledTimes(3) // Objects are different references
    })

    it('should respect cache size limit', () => {
      const fn = jest.fn((x: number) => x * 2)
      const memoizedFn = memoize(fn, { maxSize: 2 })

      memoizedFn(1)
      memoizedFn(2)
      memoizedFn(3) // Should evict cache for argument 1

      memoizedFn(1) // Should call function again
      expect(fn).toHaveBeenCalledTimes(4)
    })
  })
})