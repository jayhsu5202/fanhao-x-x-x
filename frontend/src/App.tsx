import { Route, Routes } from "react-router-dom";
import CategoryPage from "./pages/CategoryPage";
import FavoritesPage from "./pages/FavoritesPage";
import GenresPage from "./pages/GenresPage";
import HomePage from "./pages/HomePage";
import SearchResultsPage from "./pages/SearchResultsPage";
import VideoPage from "./pages/VideoPage";
import WatchHistoryPage from "./pages/WatchHistoryPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/favorites" element={<FavoritesPage />} />
      <Route path="/watch-history" element={<WatchHistoryPage />} />
      <Route path="/search" element={<SearchResultsPage />} />
      <Route path="/genres" element={<GenresPage />} />
      <Route path="/c/:category" element={<CategoryPage />} />
      <Route path="/c/:category/:subcategory" element={<CategoryPage />} />
      <Route path="/v/:slug" element={<VideoPage />} />
    </Routes>
  );
}
