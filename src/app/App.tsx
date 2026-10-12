import { NavLink, Outlet } from 'react-router-dom'
export default function App() { return <><header><NavLink to="/jokes">Банк анекдотов категории Б</NavLink><nav aria-label="Главная навигация"><NavLink to="/jokes">Каталог</NavLink><NavLink to="/atlas">Атлас</NavLink></nav></header><main id="content"><Outlet/></main></> }
