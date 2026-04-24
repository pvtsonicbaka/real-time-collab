import { useState, useEffect, useCallback, useRef } from "react";
import { API_URL } from "../utils/api";

export interface Doc {
  _id: string;
  title: string;
  content: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

const API = `${API_URL}/api/documents`;

export function useDocuments(search = "") {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const isFetching = useRef(false);

  const fetchDocs = useCallback(async (pageNum: number, q: string) => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "10" });
      if (q.trim()) params.set("search", q.trim());
      const res = await fetch(`${API}?${params}`, { credentials: "include" });
      const data = await res.json();
      setDocs((prev) => pageNum === 1 ? (data.docs ?? []) : [...prev, ...(data.docs ?? [])]);
      setHasMore(data.hasMore ?? false);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  // reset and refetch when search changes
  useEffect(() => {
    setDocs([]);
    setHasMore(true);
    fetchDocs(1, search);
  }, [search, fetchDocs]);

  const loadMore = useCallback(() => {
    if (!hasMore || isFetching.current) return;
    const next = (docs.length / 10 | 0) + 1;
    fetchDocs(next, search);
  }, [hasMore, fetchDocs, search, docs.length]);

  const addDoc = (doc: Doc) => setDocs((prev) => [doc, ...prev]);
  const removeDoc = (id: string) => setDocs((prev) => prev.filter((d) => d._id !== id));

  return { docs, loading, hasMore, loadMore, addDoc, removeDoc };
}
