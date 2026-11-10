"""Optional neural dense retrieval (fastembed, BAAI/bge-small-en-v1.5, ONNX, ~67 MB).

Built only on request: `python -m app.services.neural --build` (from backend/). The model
is cached under processed/models/ (gitignored); embeddings are stored as plain .npz.
If fastembed or the index is missing, callers fall back to LSA.
"""
from __future__ import annotations

import argparse
import sqlite3
from dataclasses import dataclass
from pathlib import Path

import numpy as np

MODEL = "BAAI/bge-small-en-v1.5"
VEC_FILE = "neural_vectors.npz"


def _model(cache: Path):
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=MODEL, cache_dir=str(cache))


def build(db_path: Path, out_dir: Path) -> dict:
    conn = sqlite3.connect(str(db_path))
    rows = conn.execute("SELECT c.chunk_id, d.title || '. ' || coalesce(c.section,'') || '. ' || c.text FROM "
                        "document_chunks c JOIN documents d USING(document_id) ORDER BY c.chunk_id").fetchall()
    conn.close()
    m = _model(out_dir / "models")
    Z = np.array(list(m.passage_embed([r[1] for r in rows], batch_size=32)), dtype=np.float32)
    Z /= np.linalg.norm(Z, axis=1, keepdims=True) + 1e-12
    np.savez_compressed(out_dir / VEC_FILE, ids=np.array([r[0] for r in rows]), Z=Z, model=np.array(MODEL))
    return {"status": "built", "model": MODEL, "chunks": len(rows), "dim": int(Z.shape[1])}


@dataclass
class NeuralIndex:
    ids: np.ndarray
    Z: np.ndarray
    cache: Path
    _m: object | None = None

    @classmethod
    def load(cls, out_dir: Path) -> "NeuralIndex | None":
        f = out_dir / VEC_FILE
        if not f.exists():
            return None
        try:
            import fastembed  # noqa: F401
        except ImportError:
            return None
        d = np.load(f, allow_pickle=False)
        return cls(d["ids"], d["Z"], out_dir / "models")

    def embed(self, text: str) -> np.ndarray:
        if self._m is None:
            self._m = _model(self.cache)
        q = np.array(list(self._m.query_embed([text]))[0], dtype=np.float32)
        return q / (np.linalg.norm(q) + 1e-12)

    def search(self, text: str, k: int = 50, allowed: set[str] | None = None) -> list[tuple[str, float]]:
        sims = self.Z @ self.embed(text)
        out = []
        for i in np.argsort(-sims):
            cid = str(self.ids[i])
            if allowed is not None and cid not in allowed:
                continue
            out.append((cid, float(sims[i])))
            if len(out) >= k:
                break
        return out


if __name__ == "__main__":
    from ..core.config import get_settings

    ap = argparse.ArgumentParser()
    ap.add_argument("--build", action="store_true")
    a = ap.parse_args()
    s = get_settings()
    if a.build:
        print(build(s.db_path, s.processed_dir))
