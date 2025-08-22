// src/components/OpinionesCarrusel.jsx
import React, { useRef, useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase (variables desde .env.local)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Evita crashear silenciosamente si faltan envs
  // Puedes reemplazar por un throw si prefieres detener la app
  console.warn("⚠️ Faltan variables de entorno de Supabase.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mezcla aleatoriamente un array (Fisher–Yates)
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Asegura unicidad por id y deja el último valor conocido de ese id
function upsertUniqueById(prev, row) {
  const exists = prev.some((x) => x.id === row.id);
  return exists ? prev.map((x) => (x.id === row.id ? row : x)) : [row, ...prev];
}

export default function OpinionesCarrusel() {
  // Estados del formulario
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [texto, setTexto] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState("");

  // Estados de la UI
  const [opiniones, setOpiniones] = useState([]);
  const [focusIdx, setFocusIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // Límites
  const MAX_TEXTO = 50;
  const MAX_NOMBRE = 20;
  const MAX_EMPRESA = 20;

  // Carga inicial + realtime
  useEffect(() => {
    const loadOpiniones = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("opiniones")
        .select("id,nombre,empresa,estrellas,texto,created_at")
        .limit(100);

      if (error) {
        console.error("Supabase select error:", error);
        setOpiniones([]);
      } else {
        setOpiniones(shuffleArray(data || []));
      }
      setLoading(false);
    };

    loadOpiniones();

    const channel = supabase
      .channel("opiniones-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "opiniones" },
        (payload) => {
          setOpiniones((prev) => upsertUniqueById(prev, payload.new));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Enviar nueva opinión
  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!nombre.trim()) return setError("Escribe tu nombre (máx. 20).");
    if (!empresa.trim()) return setError("Escribe tu empresa (máx. 20).");
    if (!texto.trim()) return setError("Escribe tu opinión (máx. 50).");

    if (nombre.trim().length > MAX_NOMBRE)
      return setError(`Nombre: máx. ${MAX_NOMBRE} caracteres.`);
    if (empresa.trim().length > MAX_EMPRESA)
      return setError(`Empresa: máx. ${MAX_EMPRESA} caracteres.`);
    if (texto.trim().length > MAX_TEXTO)
      return setError(`Opinión: máx. ${MAX_TEXTO} caracteres.`);

    if (rating < 1 || rating > 5)
      return setError("Selecciona de 1 a 5 estrellas.");

    const nueva = {
      nombre: nombre.trim(),
      empresa: empresa.trim(),
      estrellas: rating,
      texto: texto.trim(),
    };

    const { data: insertData, error: insertError } = await supabase
      .from("opiniones")
      .insert(nueva)
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      setError(`Error al guardar: ${insertError.message}`);
      return;
    }

    // Añade inmediatamente a la UI, evitando duplicados globalmente
    if (insertData) {
      setOpiniones((prev) => upsertUniqueById(prev, insertData));
    }

    // Limpiar
    setNombre("");
    setEmpresa("");
    setTexto("");
    setRating(0);
    setFocusIdx(0);
  };

  // Navegación del carrusel
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
  const next = () => setFocusIdx((i) => clamp(i + 1, 0, Math.max(0, opiniones.length - 1)));
  const prev = () => setFocusIdx((i) => clamp(i - 1, 0, Math.max(0, opiniones.length - 1)));

  // Teclas ←/→
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [opiniones.length]);

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <Header />

        {/* Formulario */}
        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre (máx. {MAX_NOMBRE})
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value.slice(0, MAX_NOMBRE))}
                placeholder="Tu nombre"
                maxLength={MAX_NOMBRE}
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empresa (máx. {MAX_EMPRESA})
              </label>
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value.slice(0, MAX_EMPRESA))}
                placeholder="Tu empresa"
                maxLength={MAX_EMPRESA}
                className="w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-1">
            Escribe tu opinión (máx. {MAX_TEXTO} caracteres)
          </label>
          <div className="flex items-center gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
              placeholder="Ej.: Muy útil y fácil de usar"
              maxLength={MAX_TEXTO}
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
            />
            <span className={`text-xs ${texto.length > MAX_TEXTO ? "text-red-600" : "text-gray-500"}`}>
              {Math.max(0, MAX_TEXTO - texto.length)}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-700 mb-1">Calificación</p>
            <StarRating value={rating} onChange={setRating} />
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700"
            >
              Enviar
            </button>
          </div>
        </form>

        {/* Carrusel */}
        <section className="relative">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-800">Opiniones</h2>
            <div className="flex gap-2">
              <IconButton label="Anterior" onClick={prev}>
                <ChevronLeftIcon />
              </IconButton>
              <IconButton label="Siguiente" onClick={next}>
                <ChevronRightIcon />
              </IconButton>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500">Cargando opiniones…</p>
          ) : opiniones.length === 0 ? (
            <p className="text-gray-500">Aún no hay opiniones. ¡Sé la primera persona en opinar!</p>
          ) : (
            <Carousel items={opiniones} focusIdx={focusIdx} onFocus={setFocusIdx} />
          )}
        </section>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-4">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
        Opiniones y calificación del curso ⭐
      </h1>
      <p className="text-gray-600 mt-1">
        Escribe un comentario breve, califica entre 1 y 5 estrellas y compártelo.
      </p>
    </div>
  );
}

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1 select-none">
      {stars.map((n) => {
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            aria-label={`Calificar con ${n} estrellas`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className={`h-7 w-7 ${active ? "fill-yellow-400 stroke-yellow-500" : "fill-transparent stroke-gray-400"}`}
              strokeWidth="1.5"
            >
              <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z" />
            </svg>
          </button>
        );
      })}
      <span className="ml-2 text-sm text-gray-600">{value || 0}/5</span>
    </div>
  );
}

function Carousel({ items, focusIdx, onFocus }) {
  const containerRef = useRef(null);
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-idx='${focusIdx}']`);
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [focusIdx]);

  return (
    <div ref={containerRef} className="overflow-x-auto snap-x snap-mandatory no-scrollbar">
      <div className="flex gap-4 pb-2">
        {items.map((op, idx) => (
          <article
            key={op.id}
            data-idx={idx}
            onClick={() => onFocus(idx)}
            className={`min-w-[300px] max-w-[300px] snap-center cursor-pointer select-none rounded-2xl border shadow-sm p-4 ${
              idx === focusIdx ? "border-indigo-500 shadow-md" : "border-gray-200"
            }`}
            title={`${op.nombre} · ${op.empresa}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-800 truncate">{op.nombre}</h3>
                <p className="text-xs text-gray-500 truncate">{op.empresa}</p>
              </div>
              <StarsSmall n={op.estrellas} />
            </div>
            <p className="mt-2 text-gray-700">{op.texto}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function StarsSmall({ n = 0 }) {
  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${i < n ? "fill-yellow-400 stroke-yellow-500" : "fill-transparent stroke-gray-300"}`}
          strokeWidth="1.5"
        >
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z" />
        </svg>
      ))}
    </div>
  );
}

function IconButton({ children, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// util para ocultar scrollbar horizontal
const styles = `
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;
if (typeof document !== "undefined" && !document.getElementById("no-scrollbar-style")) {
  const style = document.createElement("style");
  style.id = "no-scrollbar-style";
  style.innerHTML = styles;
  document.head.appendChild(style);
}




