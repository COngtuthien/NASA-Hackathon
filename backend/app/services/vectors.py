"""Local dense retrieval vectors via LSA (TF-IDF + truncated SVD).

This is the spec's "lightweight local vector search" (§0.4, §6.4) without a
neural model download. Stored as plain .npz/.json (no pickle) and rebuilt
deterministically (fixed random_state) by the ingest pipeline. It is labelled
"semantic (LSA)" in the UI, never as a neural embedding.
"""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path

import numpy as np

VEC_FILE = "lsa_vectors.npz"
VOCAB_FILE = "lsa_vocab.json"
N_COMPONENTS = 192
RANDOM_STATE = 20261110


def _vectorizer_params() -> dict:
    return dict(lowercase=True, stop_words="english", token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z0-9\-]{1,}\b")


def build_vector_index(db_path: Path, out_dir: Path) -> dict:
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer

    conn = sqlite3.connect(str(db_path))
    rows = conn.execute(
        "SELECT c.chunk_id, d.title || ' ' || coalesce(c.section,'') || ' ' || c.text FROM document_chunks c "
        "JOIN documents d USING(document_id) ORDER BY c.chunk_id").fetchall()
    conn.close()
    ids = [r[0] for r in rows]
    texts = [r[1] for r in rows]
    if len(texts) < 10:
        return {"status": "skipped", "reason": "too few chunks"}
    vec = TfidfVectorizer(sublinear_tf=True, min_df=2, max_df=0.6, **_vectorizer_params())
    X = vec.fit_transform(texts)
    k = min(N_COMPONENTS, X.shape[1] - 1, X.shape[0] - 1)
    svd = TruncatedSVD(n_components=k, random_state=RANDOM_STATE, algorithm="randomized", n_iter=7)
    Z = svd.fit_transform(X)
    Z /= np.linalg.norm(Z, axis=1, keepdims=True) + 1e-12
    out_dir.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out_dir / VEC_FILE, ids=np.array(ids), Z=Z.astype(np.float32),
                        idf=vec.idf_.astype(np.float64), components=svd.components_.astype(np.float32))
    vocab = {t: int(i) for t, i in vec.vocabulary_.items()}
    (out_dir / VOCAB_FILE).write_text(json.dumps(vocab), encoding="utf-8")
    return {"status": "built", "chunks": len(ids), "terms": len(vocab), "components": int(k),
            "explained_variance": round(float(svd.explained_variance_ratio_.sum()), 4)}


@dataclass
class LsaIndex:
    ids: np.ndarray
    Z: np.ndarray
    idf: np.ndarray
    components: np.ndarray
    vocab: dict[str, int]

    @classmethod
    def load(cls, out_dir: Path) -> "LsaIndex | None":
        f, v = out_dir / VEC_FILE, out_dir / VOCAB_FILE
        if not f.exists() or not v.exists():
            return None
        data = np.load(f, allow_pickle=False)
        return cls(data["ids"], data["Z"], data["idf"], data["components"],
                   json.loads(v.read_text(encoding="utf-8")))

    def embed(self, text: str) -> np.ndarray | None:
        from sklearn.feature_extraction.text import CountVectorizer

        cv = CountVectorizer(vocabulary=self.vocab, **_vectorizer_params())
        counts = cv.transform([text]).toarray()[0].astype(np.float64)
        if counts.sum() == 0:
            return None
        tf = np.where(counts > 0, 1.0 + np.log(np.maximum(counts, 1)), 0.0)  # sublinear_tf
        x = tf * self.idf
        x /= np.linalg.norm(x) + 1e-12
        z = self.components @ x
        nz = np.linalg.norm(z)
        return (z / nz) if nz > 0 else None

    def search(self, text: str, k: int = 50, allowed: set[str] | None = None) -> list[tuple[str, float]]:
        q = self.embed(text)
        if q is None:
            return []
        sims = self.Z @ q.astype(np.float32)
        order = np.argsort(-sims)
        out = []
        for idx in order:
            cid = str(self.ids[idx])
            if allowed is not None and cid not in allowed:
                continue
            out.append((cid, float(sims[idx])))
            if len(out) >= k:
                break
        return out
