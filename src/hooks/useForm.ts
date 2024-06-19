import { computed, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { cloneDeep, isEqual } from 'lodash-es'

type NormalObject = Record<string, any>
type Option<T extends NormalObject = NormalObject> = {
  key?: string
  formRef?: Ref<FormInstance>
  initApi: () => Promise<T>
  detailApi: (form: T) => Promise<T>
  addApi: (form: T) => Promise<T>
  editApi: (form: T) => Promise<T>
  onError?: (error: unknown) => void
  onSuccess?: (result: T) => void
  addToEdit?: boolean // 新增成功调到编辑
}

export function useFormCurd<T extends NormalObject = NormalObject>(option: Option<T>) {
  const {
    key,
    formRef,
    initApi,
    detailApi,
    addApi,
    editApi,
    onError,
    onSuccess,
    addToEdit
  } = option

  const route = useRoute()
  const router = useRouter()

  /** 表单数据 */
  const formData = reactive({} as T)
  /** 原始表单数据 */
  const rawFormData = reactive({} as T)
  const isEdit = computed(() => !!route.query[key || 'id'])
  /** 表单的数据是否改变过 */
  const isChanged = ref(false)
  /** 表单加载 */
  const loading = ref(false)
  /** 保存按钮的加载状态 */
  const saveLoading = ref(false)
  const title = computed(() => (isEdit.value ? '编辑' : '新增'))

  const initForm = async () => {
    try {
      loading.value = true
      const res = isEdit.value ? await detailApi(formData as T) : await initApi()
      if (res) {
        Object.assign(formData, res)
        Object.assign(rawFormData, res)
        isChanged.value = false
      }
    } catch (error) {
      onError && onError(error)
    } finally {
      loading.value = false
    }
  }

  initForm()

  watch(() => route.query, () => {
    initForm()
  })

  watch(() => formData, (newVal) => {
    isChanged.value = !isEqual(newVal, rawFormData)
  }, { immediate: true, deep: true })

  const save = async () => {
    if (!formRef?.value) return
    try {
      await formRef.value.validate(async (valid) => {
        if (valid) {
          saveLoading.value = true
          const res = isEdit.value ? await editApi(formData as T) : await addApi(formData as T)
          if (res) {
            ElMessage.success(isEdit.value ? '编辑成功！' : '新增成功！')
            if (!isEdit.value && addToEdit === true) {
              router.replace({
                path: route.fullPath,
                query: { [key as string]: res[key as string] }
              })
            }
            onSuccess && onSuccess(res)
          }
        } else {
          ElMessage.error('有必填项未填写，请检查数据')
        }
      })
    } catch (error) {
      onError && onError(error)
    } finally {
      saveLoading.value = false
    }
  }

  const back = () => {
    if (isChanged.value) {
      ElMessageBox.confirm(
        '您确定丢弃更改的内容吗？',
        '提示',
        {
          confirmButtonText: '确认',
          cancelButtonText: '返回',
        }
      )
      .then(()=>{
          router.back()
      })
    } else {
      router.back()
    }
  }

  const reset = () => {
    if (!isEdit.value) {
      formRef?.value?.resetFields()
    } else {
      Object.assign(formData, cloneDeep(rawFormData))
    }
  }

  return {
    formData,
    title,
    loading,
    saveLoading,
    isEdit,
    back,
    save,
    reset
  }
}
