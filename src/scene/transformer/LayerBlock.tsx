import { Text, useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { COLORS, HEAD_COLORS } from '@/core/theme';
import type { BlockOp } from '@/core/types';
import { embeddedCount } from '@/sim';
import { useAppStore } from '@/state';
import { FONTS } from '../fonts';
import { damp, useSimFrame } from '../hooks';
import { ARCH_H, LAYER_WIDTH, lanesHalfWidth, laneZ, layerX, opX } from '../layout';
import { GEOMETRY, glow } from '../materials';

const BLOCK_H = 4.2;
const tmp = new THREE.Object3D();

interface LayerBlockProps {
  layer: number;
}

/**
 * One Transformer block (pre-norm): norm gate -> attention arches (one per head, spanning
 * all lanes because attention mixes positions) -> residual add -> norm gate -> per-lane MLP
 * towers (no mixing) -> residual add.
 */
export function LayerBlock({ layer }: LayerBlockProps) {
  const trace = useAppStore((s) => s.trace);
  const total = trace.tokens.length;
  const half = lanesHalfWidth(total);
  const nHeads = trace.model.nHeads;
  const x0 = layerX(layer);

  const frame = useRef<THREE.LineBasicMaterial>(null);
  const mlp = useRef<THREE.InstancedMesh>(null);
  const residual = useRef<THREE.InstancedMesh>(null);
  const arches = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const gates = useRef<Partial<Record<BlockOp, THREE.LineBasicMaterial | null>>>({});
  const activity = useRef(0);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useLayoutEffect(() => {
    for (let p = 0; p < total; p++) {
      const z = laneZ(p, total);
      tmp.position.set(opX(layer, 'mlp') - x0, 0.3, z);
      tmp.scale.set(0.32, 0.6, 0.32);
      tmp.updateMatrix();
      mlp.current?.setMatrixAt(p, tmp.matrix);
      for (const [i, op] of (['residual1', 'residual2'] as const).entries()) {
        tmp.position.set(opX(layer, op) - x0, 0.6, z);
        tmp.scale.setScalar(0.12);
        tmp.updateMatrix();
        residual.current?.setMatrixAt(p * 2 + i, tmp.matrix);
      }
    }
    if (mlp.current) mlp.current.instanceMatrix.needsUpdate = true;
    if (residual.current) residual.current.instanceMatrix.needsUpdate = true;
  }, [layer, total, x0]);

  useSimFrame(({ event, progress, delta, trace: tr }) => {
    const here = event.layer === layer;
    // Only positions that exist so far get per-token hardware.
    const live = embeddedCount(tr, event);
    if (mlp.current) mlp.current.count = live;
    if (residual.current) residual.current.count = live * 2;
    activity.current = damp(activity.current, here ? 1 : hovered ? 0.5 : 0, 5, delta);
    if (frame.current) frame.current.opacity = 0.15 + activity.current * 0.6;

    const pulse = Math.sin(progress * Math.PI);
    arches.current.forEach((m) => {
      if (m) m.opacity = 0.25 + (here && event.op === 'attention' ? pulse * 0.75 : 0);
    });
    for (const op of ['norm1', 'norm2'] as const) {
      const g = gates.current[op];
      if (g) g.opacity = 0.3 + (here && event.op === op ? pulse * 0.7 : 0);
    }

    // MLP towers grow with the size of the MLP's write into each active lane.
    const mesh = mlp.current;
    if (mesh) {
      const lt = tr.steps[event.step]?.layers[layer];
      event.positions.forEach((p, i) => {
        if (!here || event.op !== 'mlp' || !lt) return;
        const h = 0.6 + (lt.mlpWriteNorms[i] ?? 0) * 0.8 * pulse;
        tmp.position.set(opX(layer, 'mlp') - x0, h / 2, laneZ(p, total));
        tmp.scale.set(0.32, h, 0.32);
        tmp.updateMatrix();
        mesh.setMatrixAt(p, tmp.matrix);
        mesh.instanceMatrix.needsUpdate = true;
      });
    }
    const resMat = residual.current?.material as THREE.MeshBasicMaterial | undefined;
    if (resMat) {
      const flash = here && (event.op === 'residual1' || event.op === 'residual2') ? pulse : 0;
      resMat.color.copy(glow(COLORS.token, 0.6 + flash * 2.5));
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>, op?: BlockOp) => {
    e.stopPropagation();
    useAppStore.getState().focusOn({ kind: 'layer', layer, ...(op ? { op } : {}) });
  };

  const archRadius = half;
  return (
    <group
      position={[x0, 0, 0]}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <lineSegments
        geometry={GEOMETRY.edgesBox}
        scale={[LAYER_WIDTH - 0.3, BLOCK_H, half * 2 + 0.6]}
        position={[LAYER_WIDTH / 2, BLOCK_H / 2, 0]}
      >
        <lineBasicMaterial
          ref={frame}
          color={COLORS.attention}
          transparent
          opacity={0.2}
          toneMapped={false}
        />
      </lineSegments>

      {(['norm1', 'norm2'] as const).map((op) => (
        <lineSegments
          key={op}
          geometry={GEOMETRY.edgesBox}
          scale={[0.05, 1.4, half * 2]}
          position={[opX(layer, op) - x0, 0.7, 0]}
        >
          <lineBasicMaterial
            ref={(m) => {
              gates.current[op] = m;
            }}
            color={COLORS.norm}
            transparent
            toneMapped={false}
          />
        </lineSegments>
      ))}

      {/* One arch per attention head; clicking opens the attention deep dive. */}
      <group
        position={[opX(layer, 'attention') - x0, 0, 0]}
        onClick={(e) => onClick(e, 'attention')}
      >
        {Array.from({ length: nHeads }, (_, h) => (
          <mesh
            key={h}
            position={[(h - (nHeads - 1) / 2) * 0.22, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1, ARCH_H / archRadius, 1]}
          >
            <torusGeometry args={[archRadius, 0.025, 6, 48, Math.PI]} />
            <meshBasicMaterial
              ref={(m) => {
                arches.current[h] = m;
              }}
              color={glow(HEAD_COLORS[h % HEAD_COLORS.length]!, 1.6)}
              transparent
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <instancedMesh
        ref={mlp}
        args={[GEOMETRY.box, undefined, total]}
        key={`mlp-${total}`}
        onClick={(e) => onClick(e, 'mlp')}
      >
        <meshBasicMaterial
          color={glow(COLORS.mlp, 1.1)}
          transparent
          opacity={0.55}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={residual}
        args={[GEOMETRY.octa, undefined, total * 2]}
        key={`res-${total}`}
      >
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <Text
        font={FONTS.bold}
        position={[LAYER_WIDTH / 2, BLOCK_H + 0.4, 0]}
        fontSize={0.36}
        letterSpacing={0.14}
        color={hovered ? COLORS.text : COLORS.textDim}
      >
        {`LAYER ${layer + 1}`}
      </Text>
    </group>
  );
}
