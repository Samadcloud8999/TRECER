import { useEffect, useRef } from "react";
import L from "leaflet";
export default function Map({ points, onSelect }) {
  const el = useRef();
  const map = useRef();
  const layer = useRef();
  const callback = useRef(onSelect);
  callback.current = onSelect;
  useEffect(() => {
    map.current = L.map(el.current).setView([42.8746, 74.5698], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current.remove();
    };
  }, []);
  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    const located = points.filter((p) => p.location);
    located.forEach((p) => {
      const icon = L.divIcon({
        className: "pin-wrap",
        html: `<div class="map-pin ${p.kind === "place" ? "place-pin" : ""}">${p.kind === "place" ? "♥" : "₽"}</div>`,
        iconSize: [36, 40],
        iconAnchor: [18, 36],
      });
      const m = L.marker([p.location.lat, p.location.lng], { icon }).addTo(
        layer.current,
      );
      const node = document.createElement("button");
      node.className = "map-popup";
      node.textContent = p.title || "Покупка";
      node.onclick = () => callback.current(p);
      m.bindPopup(node);
      m.on("click", () => callback.current(p));
    });
    if (located.length)
      map.current.fitBounds(
        L.latLngBounds(located.map((p) => [p.location.lat, p.location.lng])),
        { padding: [45, 45], maxZoom: 15 },
      );
  }, [points]);
  return <div className="map" ref={el} aria-label="Карта покупок и мест" />;
}
