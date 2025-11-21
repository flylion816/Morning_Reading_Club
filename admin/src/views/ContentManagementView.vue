<template>
  <AdminLayout>
    <div class="content-management-container">
      <!-- 期次选择 -->
      <el-card style="margin-bottom: 20px">
        <template #header>
          <div class="card-header">
            <span class="card-title">内容管理</span>
            <el-select
              v-model="selectedPeriodId"
              placeholder="选择期次"
              style="width: 200px"
              @change="loadPeriodContent"
            >
              <el-option
                v-for="period in periods"
                :key="period._id"
                :label="period.name"
                :value="period._id"
              />
            </el-select>
          </div>
        </template>
      </el-card>

      <!-- 内容编辑 -->
      <el-card v-if="selectedPeriodId">
        <el-tabs v-model="activeTab">
          <!-- 简介 -->
          <el-tab-pane label="简介" name="intro">
            <el-form label-width="100px">
              <el-form-item label="期次名称">
                <span>{{ currentPeriod?.name }}</span>
              </el-form-item>
              <el-form-item label="简介内容">
                <RichTextEditor
                  v-model="contentData.intro"
                  max-length="500"
                  @imageUpload="handleImageUpload"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveContent('intro')" :loading="saving">
                  保存
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 学习内容 -->
          <el-tab-pane label="学习内容" name="lessons">
            <div class="lessons-container">
              <div class="lesson-module" v-for="(lesson, index) in contentData.lessons" :key="index">
                <div class="lesson-header">
                  <h3>{{ lesson.title }}</h3>
                  <el-button text type="danger" @click="removeLesson(index)">删除</el-button>
                </div>
                <RichTextEditor
                  v-model="lesson.content"
                  max-length="1000"
                  @imageUpload="handleImageUpload"
                />
              </div>

              <el-button
                @click="addLesson"
                style="margin-top: 16px"
              >
                + 添加学习模块
              </el-button>

              <el-button
                type="primary"
                @click="saveContent('lessons')"
                :loading="saving"
                style="margin-top: 16px; margin-left: 12px"
              >
                保存所有
              </el-button>
            </div>
          </el-tab-pane>

          <!-- FAQ -->
          <el-tab-pane label="常见问题" name="faq">
            <div class="faq-container">
              <div class="faq-item" v-for="(faq, index) in contentData.faq" :key="index">
                <div class="faq-header">
                  <el-input
                    v-model="faq.question"
                    placeholder="问题"
                    style="margin-bottom: 8px"
                  />
                  <el-button text type="danger" @click="removeFaq(index)">删除</el-button>
                </div>
                <el-input
                  v-model="faq.answer"
                  type="textarea"
                  placeholder="答案"
                  :rows="3"
                />
              </div>

              <el-button @click="addFaq" style="margin-top: 16px">
                + 添加问答
              </el-button>

              <el-button
                type="primary"
                @click="saveContent('faq')"
                :loading="saving"
                style="margin-top: 16px; margin-left: 12px"
              >
                保存所有
              </el-button>
            </div>
          </el-tab-pane>

          <!-- 媒体 -->
          <el-tab-pane label="媒体资源" name="media">
            <div class="media-container">
              <el-upload
                class="upload-area"
                drag
                action="#"
                :auto-upload="false"
                @change="handleMediaUpload"
              >
                <el-icon class="el-icon--upload"><CloudUpload /></el-icon>
                <div class="el-upload__text">
                  将文件拖到此处或 <em>点击上传</em>
                </div>
              </el-upload>

              <div class="media-list" v-if="contentData.media.length > 0">
                <div class="media-item" v-for="(media, index) in contentData.media" :key="index">
                  <span>{{ media.name }}</span>
                  <el-button text type="danger" @click="removeMedia(index)">删除</el-button>
                </div>
              </div>

              <el-button
                type="primary"
                @click="saveContent('media')"
                :loading="saving"
                style="margin-top: 16px"
              >
                保存
              </el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <el-empty v-else description="请先选择一个期次" />
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '../components/AdminLayout.vue'
import RichTextEditor from '../components/RichTextEditor.vue'
import { periodApi, uploadApi } from '../services/api'
import { ElMessage } from 'element-plus'
import { CloudUpload } from '@element-plus/icons-vue'

const selectedPeriodId = ref<string | null>(null)
const activeTab = ref('intro')
const periods = ref<any[]>([])
const currentPeriod = ref<any>(null)
const saving = ref(false)
const uploading = ref(false)

const contentData = ref({
  intro: '',
  lessons: [
    { title: '静一静', content: '' },
    { title: '问一问', content: '' },
    { title: '读一读', content: '' },
    { title: '想一想', content: '' },
    { title: '记一记', content: '' }
  ],
  faq: [
    { question: '', answer: '' }
  ],
  media: []
})

onMounted(() => {
  loadPeriods()
})

async function loadPeriods() {
  try {
    const response = await periodApi.getPeriods({ limit: 100 })
    periods.value = response.list || []
  } catch (err) {
    ElMessage.error('加载期次列表失败')
  }
}

async function loadPeriodContent() {
  if (!selectedPeriodId.value) return

  try {
    const response = await periodApi.getPeriodDetail(selectedPeriodId.value)
    currentPeriod.value = response
    // 加载已保存的内容
    contentData.value = {
      intro: response.intro || '',
      lessons: response.lessons || contentData.value.lessons,
      faq: response.faq || contentData.value.faq,
      media: response.media || []
    }
  } catch (err) {
    ElMessage.error('加载期次内容失败')
  }
}

async function saveContent(type: string) {
  if (!selectedPeriodId.value) return

  saving.value = true
  try {
    const updateData: any = {}

    if (type === 'intro' || !type) {
      updateData.intro = contentData.value.intro
    }
    if (type === 'lessons' || !type) {
      updateData.lessons = contentData.value.lessons
    }
    if (type === 'faq' || !type) {
      updateData.faq = contentData.value.faq
    }
    if (type === 'media' || !type) {
      updateData.media = contentData.value.media
    }

    await periodApi.updatePeriod(selectedPeriodId.value, updateData)
    ElMessage.success('内容保存成功')
  } catch (err) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function addLesson() {
  contentData.value.lessons.push({
    title: `学习模块 ${contentData.value.lessons.length + 1}`,
    content: ''
  })
}

function removeLesson(index: number) {
  contentData.value.lessons.splice(index, 1)
}

function addFaq() {
  contentData.value.faq.push({
    question: '',
    answer: ''
  })
}

function removeFaq(index: number) {
  contentData.value.faq.splice(index, 1)
}

function handleImageUpload(file: File) {
  // 图片上传已在 RichTextEditor 中处理，此函数保留用于其他可能的处理
  console.log('Image uploaded:', file.name)
}

async function handleMediaUpload(event: any) {
  const file = event.raw || event.target.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const response = await uploadApi.uploadFile(file)
    const uploadedFile = response.data

    contentData.value.media.push({
      name: file.name,
      type: file.type,
      size: file.size,
      url: uploadedFile.url,
      uploadedAt: uploadedFile.uploadedAt
    })

    ElMessage.success('文件上传成功')
  } catch (err) {
    console.error('Media upload failed:', err)
    ElMessage.error('文件上传失败，请重试')
  } finally {
    uploading.value = false
  }
}

function removeMedia(index: number) {
  contentData.value.media.splice(index, 1)
}
</script>

<style scoped>
.content-management-container {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.lessons-container {
  padding: 20px 0;
}

.lesson-module {
  margin-bottom: 24px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
}

.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.lesson-header h3 {
  margin: 0;
  font-size: 16px;
}

.faq-container {
  padding: 20px 0;
}

.faq-item {
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
}

.faq-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
}

.media-container {
  padding: 20px 0;
}

.upload-area {
  width: 100%;
}

.media-list {
  margin-top: 20px;
}

.media-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 8px;
}
</style>
