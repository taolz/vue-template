import { computed, ref } from 'vue'

type NormalObject = Record<string, any>
interface OffsetPagination {
  start: number
  pageSize: number
}
interface Pagination {
  page: number
  pageSize: number
}

interface TableResult<R = any> {
  total: number
  rows: R[]
}

interface Options<T = any> {
  params?: NormalObject
  apiFn: (params: NormalObject, pagination?: Pagination | OffsetPagination) => Promise<TableResult>
  onFormat?: (data: T[]) => T[]
  onSuccess?: () => void
  onFail?: (error?: unknown) => void
  pageable?: boolean
  useOffsetPagination?: boolean
  immediate?: boolean
}

/**
 * 通用表格逻辑
 * @description table 页面操作方法封装
 * @param options
 */
export default function useTable<T extends NormalObject = NormalObject>(options: Options) {
  type Table = TableResult<T>

  const { params, apiFn, onFormat, onSuccess, onFail, pageable, useOffsetPagination, immediate } = options

  const loading = ref(false)
  const tableData = ref<T[]>([])
  const total = ref(0)
  const pagination = ref<Pagination>({
    page: 1,
    pageSize: 10,
  })
  const initialParams = JSON.parse(JSON.stringify(params || {}))

  // 接口请求相关--start
  const isPageable = pageable ?? true
  const isUseOffsetPagination = useOffsetPagination ?? true
  const isImmediate = immediate ?? true

  // 分页参数
  const computedPagination = computed(() => {
    const { page, pageSize } = pagination.value
    const offsetPagination = {
      start: (page - 1) * pageSize,
      pageSize
    }
    if (!isPageable) return void 0
    if (isUseOffsetPagination) return offsetPagination
    else return { page, pageSize }
  })

  /**
   * 处理分页
   */
  const handlePagination = async(res: Table) => {
    const { page, pageSize } = pagination.value
    const totalPage = Math.ceil(total.value / pageSize)
    const limitFlag = totalPage > pageSize

    // 如果是分页，且当前页没有数据，且当前页不是第一页，总页数大于当前页，那么请求最后一页
    if (isPageable && res.rows.length === 0 && limitFlag && page > 1) {
      pagination.value.page = totalPage
      await getList()
    } else {
      tableData.value = onFormat ? onFormat(res.rows) : res.rows
      total.value = res.total
      onSuccess && onSuccess()
    }
  }

  /**
   * 获取列表
   */
  const getList = async() => {
    if (!apiFn) throw new Error('请传入 apiFn !')

    try {
      loading.value = true
      const otherParams = params || {}
      const res = await apiFn(otherParams, computedPagination.value)
      if (!res || typeof res.total !== 'number' || !Array.isArray(res.rows)) {
        throw new Error('Invalid response from api function')
      }
      await handlePagination(res)
    } catch (error) {
      onFail && onFail(error)
      // eslint-disable-next-line no-console
      console.error('Failed to fetch data:', error)
    } finally {
      loading.value = false
    }
  }
  // 接口请求相关--end

  /**
   * 每页条数改变
   */
  const handlePageSizeChange = (pageSize: number) => {
    pagination.value = {
      page: 1,
      pageSize
    }
    getList()
  }

  /**
   * 当前页改变
   */
  const handleCurrentChange = (page: number) => {
    pagination.value.page = page
    getList()
  }

  /**
   * 重置参数
   */
  const resetParams = (reload: boolean = true) => {
    pagination.value.page = 1
    Object.keys(initialParams).forEach(item => {
      params![item] = initialParams[item]
    })
    if (reload) {
      getList()
    }
  }

  // 立即请求
  isImmediate && getList()

  return {
    tableData,
    loading,
    total,
    pagination,
    getList,
    resetParams,
    handleCurrentChange,
    handlePageSizeChange,
  }
}
