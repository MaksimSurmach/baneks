import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import App from './App'
import { routeErrorPaths } from './routes'
const Atlas = lazy(() => import('../pages/AtlasPlaceholder'))
function Shell({ text }: { text: string }) { return <section><h1>{text}</h1><p>Каталог готовится к подключению.</p><p>Поиск скоро</p></section> }
export const router = createBrowserRouter([{ element: <App/>, errorElement: <Shell text="Не удалось открыть страницу"/>, children: [{ path: '/', element: <Navigate to="/jokes" replace/> }, { path: '/jokes', element: <Shell text="Каталог анекдотов"/> }, { path: '/jokes/:id', element: <Shell text="Анекдот"/> }, { path: '/topics/:kind/:slug', element: <Shell text="Тема"/> }, { path: '/atlas', element: <Suspense fallback={<p>Загрузка…</p>}><Atlas/></Suspense> }, ...routeErrorPaths.map(path => ({ path: '/'+path, element: <Shell text={path === '404' ? 'Страница не найдена' : 'Не удалось загрузить данные'}/> })), { path: '*', element: <Shell text="Страница не найдена"/> }] }])
