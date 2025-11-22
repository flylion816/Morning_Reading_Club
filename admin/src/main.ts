import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 关键：在使用 router 之前就初始化 token，否则路由守卫会在 token 未恢复时执行
console.log('[Main] 应用启动，初始化 token...')
const authStore = useAuthStore()
authStore.initToken()
console.log('[Main] token 初始化完成')

app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
