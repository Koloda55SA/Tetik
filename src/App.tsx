import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Bazar from './pages/Bazar'
import ListingPage from './pages/ListingPage'
import NewListing from './pages/NewListing'
import Chats from './pages/Chats'
import ChatRoom from './pages/ChatRoom'
import Stores from './pages/Stores'
import StorePage from './pages/StorePage'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import Favorites from './pages/Favorites'
import StoreNew from './pages/StoreNew'
import Cars from './pages/Cars'
import CarPage from './pages/CarPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/bazar" element={<Bazar />} />
        <Route path="/l/:id" element={<ListingPage />} />
        <Route path="/new" element={<NewListing />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/chats/:id" element={<ChatRoom />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/s/:slug" element={<StorePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Onboarding />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/store/new" element={<StoreNew />} />
        <Route path="/cars" element={<Cars />} />
        <Route path="/cars/:slug" element={<CarPage />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
