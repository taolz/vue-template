import { computed, ref } from 'vue'

type NormalObject = Record<string, any>
interface Pagination {
  pageSize: number
  start: number
  page: number
}

/**
 * 判断对象是否有某个属性
 * @param obj 对象
 * @param keys 属性名
 */
const hasOwnProperty = (obj: NormalObject, keys: string | string[]) => {
  if (Array.isArray(keys)) {
    return keys.every((key) => key in obj)
  } else {
    return keys in obj
  }
}

interface TableResult<T = any> {
  total: number
  rows: T[]
}

type RequestTableResult<T = any> = TableResult<T> | T

interface Options<T = any> {
  params?: NormalObject
  apiFn: (params: NormalObject, pagination?: Pagination) => Promise<RequestTableResult>
  callback?: (data: RequestTableResult) => TableResult<T>
  onSuccess?: () => void
  onFail?: () => void
  isPageable?: boolean
  immediate?: boolean
}


/**
 * 快开通用表格逻辑
 * @param options
 */
export default function useTable<T extends NormalObject = NormalObject> (options: Options) {
  const loading = ref(false)
  const tableData = ref<T[]>([])
  const total = ref(0)
  const pagination = ref<Pagination>({
    start: 1,
    page: 1,
    pageSize: 10,
  })
  const paramsInit = JSON.parse(JSON.stringify(options.params || {}))

  // 接口请求相关--start
  const _isPageable = computed(() => options.isPageable ?? true)

  /**
   * 处理接口返回数据
   */
  const handleApiResponse = (res: RequestTableResult) => {
    options.callback && (res = options.callback(res))
    if (!hasOwnProperty(res, ['rows', 'total'])) {
      throw new Error('接口返回格式不正确')
    }
    return res
  }

  /**
   * 处理分页
   */
  const handlePagination = async (res: RequestTableResult) => {
    const handleData = (res: any) => {
      if (_isPageable.value) {
        tableData.value = res.rows
        total.value = res.total
      } else {
        tableData.value = res
        total.value = res.length
      }
      options.onSuccess && options.onSuccess()
    }

    // 如果是分页，且当前页没有数据，且当前页不是第一页，且总页数大于当前页，那么请求最后一页
    if (_isPageable.value && res.rows.length === 0 && pagination.value.page > 1) {
      const totalPages = total.value % pagination.value.page
        ? Math.ceil(total.value / pagination.value.pageSize)
        : total.value / pagination.value.pageSize

      if (totalPages > pagination.value.page) {
        pagination.value.page = totalPages
        await getList()
      }
    } else {
      handleData(res)
    }
  }

  /**
   * 获取列表
   */
  const getList = async () => {
    loading.value = true

    try {
      const otherParams = options.params || {}
      const paginationParams = _isPageable.value ? pagination.value : void 0
      const res = await options.apiFn(otherParams, paginationParams).finally(() => (loading.value = false))
      const processedRes = handleApiResponse(res)
      await handlePagination(processedRes)
    } catch (error) {
      // 处理其他错误，例如网络请求失败等
      options.onFail && options.onFail()
    }
  }
  // 接口请求相关--end

  const handlePageSizeChange = (pageSize: number) => {
    pagination.value = { ...pagination.value, page: 1, pageSize }
    getList()
  }

  const handleCurrentChange = (page: number) => {
    pagination.value = { ...pagination.value, page }
    getList()
  }

  const resetParams = () => {
    Object.keys(paramsInit).forEach(item => {
      options.params![item] = paramsInit[item]
    })
    getList()
  }

  if (options.immediate ?? true) getList()

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
