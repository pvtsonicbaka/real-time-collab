import { useState, useEffect, useCallback, useRef } from "react";

export interface Doc {
  _id: string;
  title: string;
  content: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

const API = "http://localhost:5000/api/documents";

export function useDocuments() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const isFetching = useRef(false); // prevents duplicate requests

  const fetchDocs = useCallback(async (pageNum: number) => {
    if (isFetching.current) return; // block if already fetching
    isFetching.current = true;
    setLoading(true);
    try {
      const res = await fetch(`${API}?page=${pageNum}&limit=10`, {
        credentials: "include",
      });
      const data = await res.json();
      setDocs((prev) => pageNum === 1 ? data.docs : [...prev, ...data.docs]);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchDocs(1);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || isFetching.current) return; // double guard
    setPage((prev) => {
      const next = prev + 1;
      fetchDocs(next); // use next directly, not stale state
      return next;
    });
  }, [hasMore, fetchDocs]);

  const addDoc = (doc: Doc) => setDocs((prev) => [doc, ...prev]);
  const removeDoc = (id: string) => setDocs((prev) => prev.filter((d) => d._id !== id));

  return { docs, loading, hasMore, loadMore, addDoc, removeDoc };
}
