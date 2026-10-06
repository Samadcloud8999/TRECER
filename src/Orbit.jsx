import { useEffect, useRef } from "react";
import * as THREE from "three";
export default function Orbit() {
  const ref = useRef();
  useEffect(() => {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }
    const el = ref.current;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(210, 160);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 210 / 160, 0.1, 100);
    camera.position.z = 6;
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 5);
    light.position.set(2, 3, 4);
    scene.add(light);
    const group = new THREE.Group();
    scene.add(group);
    const geometry = new THREE.TorusGeometry(0.9, 0.22, 24, 64);
    const materials = [
      new THREE.MeshStandardMaterial({
        color: 0xd4f479,
        metalness: 0.45,
        roughness: 0.22,
      }),
      new THREE.MeshStandardMaterial({
        color: 0x718b70,
        metalness: 0.6,
        roughness: 0.2,
      }),
    ];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(geometry, materials[i]);
      m.position.x = i ? 0.47 : -0.47;
      m.rotation.x = i ? 0.8 : -0.8;
      m.rotation.y = i ? -0.55 : 0.55;
      group.add(m);
    }
    let frame;
    const animate = (t) => {
      group.rotation.y = Math.sin(t * 0.0005) * 0.25;
      group.rotation.z = -0.25;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      renderer.render(scene, camera);
    } else frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div className="orbit" ref={ref} aria-hidden="true" />;
}
