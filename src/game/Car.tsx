// ============================================
// CAR - Physics-enabled Car with Full RL Mechanics
// ============================================
import { useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { Html, Trail } from '@react-three/drei';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import {
  CAR_WIDTH, CAR_HEIGHT, CAR_LENGTH, CAR_MASS,
  CAR_MAX_SPEED, CAR_BOOST_MAX_SPEED, CAR_ACCELERATION, CAR_BRAKE_FORCE,
  CAR_TURN_SPEED, CAR_AIR_TURN_SPEED,
  BOOST_MAX, BOOST_CONSUMPTION_RATE, BOOST_FORCE,
  JUMP_FORCE, DOUBLE_JUMP_FORCE, DODGE_FORCE, DODGE_TORQUE, DODGE_TIMER,
  MAX_JUMPS, SUPERSONIC_SPEED, DEMOLITION_RESPAWN_TIME,
  BLUE_TEAM_COLOR, ORANGE_TEAM_COLOR, BLUE_TEAM_EMISSIVE, ORANGE_TEAM_EMISSIVE,
} from '../constants';
import type { PlayerInput, Team } from '../types';
import { audioManager } from '../audio/AudioManager';
import { useGameStore } from '../stores/gameStore';

export interface CarHandle {
  getPosition: () => THREE.Vector3;
  getRotation: () => THREE.Quaternion;
  getVelocity: () => THREE.Vector3;
  getSpeed: () => number;
  getBoost: () => number;
  setBoost: (val: number) => void;
  isOnGround: () => boolean;
  isDemolished: () => boolean;
  reset: (position: [number, number, number], rotationY: number) => void;
  applyInput: (input: PlayerInput, delta: number) => void;
  getRigidBody: () => RapierRigidBody | null;
  demolish: () => void;
}

interface CarProps {
  team: Team;
  startPosition: [number, number, number];
  startRotationY: number;
  name: string;
}

const Car = forwardRef<CarHandle, CarProps>(({ team, startPosition, startRotationY, name }, ref) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const meshGroupRef = useRef<THREE.Group>(null);
  const boostFlameRef = useRef<THREE.Mesh>(null);
  const taillightLeftRef = useRef<THREE.Mesh>(null);
  const taillightRightRef = useRef<THREE.Mesh>(null);
  const { world } = useRapier();

  // State refs (avoid re-renders)
  const boost = useRef(33);
  const jumpsLeft = useRef(2);
  const jumpTimer = useRef(0);
  const lastJumpTime = useRef(0);
  const isGrounded = useRef(true);
  const demolished = useRef(false);
  const demolishTimer = useRef(0);
  const wasJumpPressed = useRef(false);
  const supersonicRef = useRef(false);
  const flipCancelTimer = useRef(0);
  const lastEmptyBoostTime = useRef(0);
  const lastScreechTime = useRef(0);
  const jumpHoldTimer = useRef(0);

  // Boost trail particles
  const boostTrailRef = useRef<THREE.Points>(null);
  const boostActive = useRef(false);

  const teamColor = team === 'blue' ? BLUE_TEAM_COLOR : ORANGE_TEAM_COLOR;
  const emissiveColor = team === 'blue' ? BLUE_TEAM_EMISSIVE : ORANGE_TEAM_EMISSIVE;

  // Quaternion for start rotation
  const startQuat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(0, startRotationY, 0));
    return q;
  }, [startRotationY]);

  useImperativeHandle(ref, () => ({
    getPosition: () => {
      if (rigidBodyRef.current) {
        const pos = rigidBodyRef.current.translation();
        return new THREE.Vector3(pos.x, pos.y, pos.z);
      }
      return new THREE.Vector3(...startPosition);
    },
    getRotation: () => {
      if (rigidBodyRef.current) {
        const rot = rigidBodyRef.current.rotation();
        return new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
      }
      return startQuat.clone();
    },
    getVelocity: () => {
      if (rigidBodyRef.current) {
        const vel = rigidBodyRef.current.linvel();
        return new THREE.Vector3(vel.x, vel.y, vel.z);
      }
      return new THREE.Vector3();
    },
    getSpeed: () => {
      if (rigidBodyRef.current) {
        const vel = rigidBodyRef.current.linvel();
        return Math.sqrt(vel.x ** 2 + vel.z ** 2);
      }
      return 0;
    },
    getBoost: () => boost.current,
    setBoost: (val: number) => { boost.current = Math.min(val, BOOST_MAX); },
    isOnGround: () => isGrounded.current,
    isDemolished: () => demolished.current,
    reset: (position: [number, number, number], rotationY: number) => {
      if (rigidBodyRef.current) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0));
        rigidBodyRef.current.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
        rigidBodyRef.current.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      boost.current = 33;
      jumpsLeft.current = 2;
      jumpTimer.current = 0;
      demolished.current = false;
      demolishTimer.current = 0;
      supersonicRef.current = false;
    },
    applyInput: (input: PlayerInput, delta: number) => {
      applyCarInput(input, delta);
    },
    getRigidBody: () => rigidBodyRef.current,
    demolish: () => {
      demolished.current = true;
      demolishTimer.current = DEMOLITION_RESPAWN_TIME;
      if (rigidBodyRef.current) {
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        rigidBodyRef.current.setTranslation({ x: 0, y: -50, z: 0 }, true);
      }
    },
  }));

  function checkGrounded(): boolean {
    if (!rigidBodyRef.current || !world) return false;
    const pos = rigidBodyRef.current.translation();
    const rot = rigidBodyRef.current.rotation();
    
    const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const localDown = new THREE.Vector3(0, -1, 0).applyQuaternion(quat);
    const origin = { x: pos.x, y: pos.y, z: pos.z };

    // Raycast local downward (for walls/ceilings)
    const rayLocal = world.castRay(
      { origin, dir: { x: localDown.x, y: localDown.y, z: localDown.z } } as any,
      CAR_HEIGHT * 0.5 + 0.4,
      true, undefined, undefined, undefined, rigidBodyRef.current
    );

    if (rayLocal !== null) return true;

    // Raycast global downward (fallback for floor)
    const rayGlobal = world.castRay(
      { origin, dir: { x: 0, y: -1, z: 0 } } as any,
      CAR_HEIGHT * 0.5 + 0.4,
      true, undefined, undefined, undefined, rigidBodyRef.current
    );

    return rayGlobal !== null;
  }

  function applyCarInput(input: PlayerInput, delta: number) {
    if (!rigidBodyRef.current) return;
    if (demolished.current) return;

    const rb = rigidBodyRef.current;
    const pos = rb.translation();
    const rot = rb.rotation();
    const vel = rb.linvel();

    const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);

    isGrounded.current = checkGrounded();
    const onGround = isGrounded.current;

    // Apply Sticky Downforce when on a surface (Wall riding)
    if (onGround) {
      rb.applyImpulse({ 
        x: -up.x * CAR_MASS * 40 * delta, 
        y: -up.y * CAR_MASS * 40 * delta, 
        z: -up.z * CAR_MASS * 40 * delta 
      }, true);
    }

    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);

    // Update jump timers
    if (jumpTimer.current > 0) {
      jumpTimer.current -= delta;
      if (jumpTimer.current <= 0) {
        jumpTimer.current = 0;
        if (jumpsLeft.current === 1) {
          jumpsLeft.current = 0; // Dodge window expired
        }
      }
    }

    if (flipCancelTimer.current > 0) {
      flipCancelTimer.current -= delta;
    }

    // Reset jumps when grounded
    if (onGround) {
      jumpsLeft.current = MAX_JUMPS;
      jumpTimer.current = 0;
      flipCancelTimer.current = 0;
    }

    const maxSpeed = input.boost && boost.current > 0 ? CAR_BOOST_MAX_SPEED : CAR_MAX_SPEED;

    // === APPLY CUSTOM GRAVITY (Wall Riding) ===
    if (onGround) {
      // Stick to surface (down relative to car)
      const localDown = new THREE.Vector3(0, -1, 0).applyQuaternion(quat);
      rb.applyImpulse({ x: localDown.x * 40 * CAR_MASS * delta, y: localDown.y * 40 * CAR_MASS * delta, z: localDown.z * 40 * CAR_MASS * delta }, true);
    } else {
      // Global gravity when in air
      rb.applyImpulse({ x: 0, y: -30 * CAR_MASS * delta, z: 0 }, true);
    }

    // === ACCELERATION / BRAKING ===
    if (onGround) {
      if (input.forward) {
        const forwardSpeed = forward.dot(new THREE.Vector3(vel.x, 0, vel.z));
        if (forwardSpeed < maxSpeed) {
          const force = forward.clone().multiplyScalar(CAR_ACCELERATION * CAR_MASS);
          rb.applyImpulse({ x: force.x * delta, y: 0, z: force.z * delta }, true);
        }
      }
      if (input.backward) {
        const forwardSpeed = forward.dot(new THREE.Vector3(vel.x, 0, vel.z));
        if (forwardSpeed > -maxSpeed * 0.5) {
          const force = forward.clone().multiplyScalar(-CAR_BRAKE_FORCE * CAR_MASS);
          rb.applyImpulse({ x: force.x * delta, y: 0, z: force.z * delta }, true);
        }
      }

      // Steering (only when moving)
      if (speed > 1) {
        let turnMultiplier = Math.min(1, speed / 10); // Less turning at low speed
        if (input.drift) turnMultiplier *= 2.5; // Drift makes turning sharper
        
        if (input.left) {
          rb.applyTorqueImpulse({ x: 0, y: CAR_TURN_SPEED * CAR_MASS * turnMultiplier * delta, z: 0 }, true);
        }
        if (input.right) {
          rb.applyTorqueImpulse({ x: 0, y: -CAR_TURN_SPEED * CAR_MASS * turnMultiplier * delta, z: 0 }, true);
        }
      }

      // Ground friction / speed limiting
      if (!input.forward && !input.backward) {
        rb.setLinvel({ x: vel.x * 0.98, y: vel.y, z: vel.z * 0.98 }, true);
      }

      // Clamp horizontal speed
      const hSpeed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
      if (hSpeed > maxSpeed) {
        const ratio = maxSpeed / hSpeed;
        rb.setLinvel({ x: vel.x * ratio, y: vel.y, z: vel.z * ratio }, true);
      }

    } else {
      // Air control
      const torqueMag = CAR_AIR_TURN_SPEED * CAR_MASS * delta;
      
      // Yaw
      if (input.left) {
        rb.applyTorqueImpulse({ x: up.x * torqueMag, y: up.y * torqueMag, z: up.z * torqueMag }, true);
      }
      if (input.right) {
        rb.applyTorqueImpulse({ x: -up.x * torqueMag, y: -up.y * torqueMag, z: -up.z * torqueMag }, true);
      }
      // Air roll
      if (input.airRollLeft) {
        rb.applyTorqueImpulse({ x: forward.x * torqueMag, y: forward.y * torqueMag, z: forward.z * torqueMag }, true);
      }
      if (input.airRollRight) {
        rb.applyTorqueImpulse({ x: -forward.x * torqueMag, y: -forward.y * torqueMag, z: -forward.z * torqueMag }, true);
      }
      // Pitch control in air (Amplified for Flip Cancel / Half-Flip)
      const flipCancelMultiplier = flipCancelTimer.current > 0 ? 15 : 0.8;
      if (input.forward) {
        rb.applyTorqueImpulse({ x: right.x * torqueMag * flipCancelMultiplier, y: right.y * torqueMag * flipCancelMultiplier, z: right.z * torqueMag * flipCancelMultiplier }, true);
      }
      if (input.backward) {
        rb.applyTorqueImpulse({ x: -right.x * torqueMag * flipCancelMultiplier, y: -right.y * torqueMag * flipCancelMultiplier, z: -right.z * torqueMag * flipCancelMultiplier }, true);
      }
    }

    // === BOOST ===
    boostActive.current = false;
    if (input.boost) {
      if (boost.current > 0) {
        boost.current = Math.max(0, boost.current - BOOST_CONSUMPTION_RATE * delta);
        const boostDir = forward.clone().multiplyScalar(BOOST_FORCE * CAR_MASS * delta);
        rb.applyImpulse({ x: boostDir.x, y: boostDir.y, z: boostDir.z }, true);
        boostActive.current = true;
      } else if (name === 'Player') {
        const nowMs = performance.now();
        if (nowMs - lastEmptyBoostTime.current > 150) {
          audioManager.playEmptyBoost();
          lastEmptyBoostTime.current = nowMs;
        }
      }
    }

    // === JUMP ===
    if (input.jump) {
      if (!wasJumpPressed.current) {
        if (onGround && jumpsLeft.current === MAX_JUMPS) {
          // First jump (initial impulse)
          rb.applyImpulse({ x: up.x * JUMP_FORCE * 0.5 * CAR_MASS, y: up.y * JUMP_FORCE * 0.5 * CAR_MASS, z: up.z * JUMP_FORCE * 0.5 * CAR_MASS }, true);
          jumpsLeft.current = 1;
          jumpTimer.current = DODGE_TIMER;
          jumpHoldTimer.current = 0.2; // 200ms of variable hold jump
          lastJumpTime.current = performance.now();
          if (name === 'Player') audioManager.playJump();
        } else if (!onGround && jumpsLeft.current === 1 && jumpTimer.current > 0) {
          // Dodge/flip, stall, or double jump
        const isStall = (input.airRollRight && input.left) || (input.airRollLeft && input.right);
        
        if (isStall) {
          // Stall mechanic: cancel vertical velocity and rotational velocity
          rb.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
          rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
          if (name === 'Player') audioManager.playDodge();
        } else {
          const hasDirection = input.forward || input.backward || input.left || input.right;
          if (hasDirection) {
            // Dodge in direction
            let dodgeX = 0;
            let dodgeZ = 0;
            if (input.forward) dodgeZ = -1;
            if (input.backward) dodgeZ = 1;
            if (input.left) dodgeX = -1;
            if (input.right) dodgeX = 1;

            // Zero out vertical velocity (standard RL mechanic)
            rb.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);

            const dodgeDir = new THREE.Vector3(dodgeX, 0, dodgeZ).normalize().applyQuaternion(quat);
            rb.applyImpulse(
              { x: dodgeDir.x * DODGE_FORCE * CAR_MASS, y: 0, z: dodgeDir.z * DODGE_FORCE * CAR_MASS },
              true
            );
            // Apply torque for flip animation
            rb.applyTorqueImpulse(
              { x: dodgeZ * DODGE_TORQUE * CAR_MASS, y: 0, z: -dodgeX * DODGE_TORQUE * CAR_MASS },
              true
            );
            flipCancelTimer.current = 0.6; // Allow half-flip for 0.6 seconds
            if (name === 'Player') audioManager.playDodge();
          } else {
            // Double jump (straight up)
            rb.applyImpulse({ x: 0, y: DOUBLE_JUMP_FORCE * CAR_MASS, z: 0 }, true);
            if (name === 'Player') audioManager.playJump();
          }
        }
        jumpsLeft.current = 0;
        jumpTimer.current = 0;
      }
    } else {
      // Jump button is held
      if (jumpHoldTimer.current > 0 && jumpsLeft.current === 1) {
        // Apply continuous force. Total added over 0.2s = JUMP_FORCE * 0.5
        const holdForce = (JUMP_FORCE * 0.5) / 0.2;
        rb.applyImpulse({ x: up.x * holdForce * delta * CAR_MASS, y: up.y * holdForce * delta * CAR_MASS, z: up.z * holdForce * delta * CAR_MASS }, true);
      }
    }
    }
    
    // Decrease hold timer
    if (jumpHoldTimer.current > 0) {
      jumpHoldTimer.current -= delta;
    }

    wasJumpPressed.current = input.jump;

    // === SUPERSONIC CHECK ===
    const isSuper = speed >= SUPERSONIC_SPEED;
    supersonicRef.current = isSuper;
    if (name === 'Player') {
      const storeIsSuper = useGameStore.getState().isSupersonic;
      if (isSuper !== storeIsSuper) {
        useGameStore.getState().setIsSupersonic(isSuper);
        if (isSuper) {
          audioManager.playSonicBoom();
        }
      }
    }

    // Damping angular velocity on ground to prevent spinning
    if (onGround) {
      const angvel = rb.angvel();
      const dampY = input.drift ? 0.99 : 0.95; // Allow spinning when drifting
      rb.setAngvel({ x: angvel.x * 0.9, y: angvel.y * dampY, z: angvel.z * 0.9 }, true);
    }
    
    // Update engine sound for player
    if (name === 'Player') {
      audioManager.updateEngine(speed, boostActive.current, onGround);
    }

    // Update taillights (Brake lights)
    const hSpeed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
    const isBraking = input.backward && hSpeed > 5;
    const taillightIntensity = isBraking ? 4 : 1;
    if (taillightLeftRef.current) (taillightLeftRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = taillightIntensity;
    if (taillightRightRef.current) (taillightRightRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = taillightIntensity;

    // Tire Screech
    const nowMs = performance.now();
    if (onGround && name === 'Player') {
        const isTurningHard = (input.left || input.right) && hSpeed > 15;
        if ((isBraking || isTurningHard) && nowMs - lastScreechTime.current > 300) {
            audioManager.playTireScreech();
            lastScreechTime.current = nowMs;
        }
    }
  }

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || !meshGroupRef.current) return;

    // Handle demolition timer
    if (demolished.current) {
      demolishTimer.current -= delta;
      if (demolishTimer.current <= 0) {
        demolished.current = false;
        if (rigidBodyRef.current) {
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, startRotationY, 0));
          rigidBodyRef.current.setTranslation({ x: startPosition[0], y: startPosition[1], z: startPosition[2] }, true);
          rigidBodyRef.current.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
          rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
          rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
          boost.current = 33;
        }
      }
      return;
    }

    // Sync visual mesh with physics
    const pos = rigidBodyRef.current.translation();
    const rot = rigidBodyRef.current.rotation();
    meshGroupRef.current.position.set(pos.x, pos.y, pos.z);
    meshGroupRef.current.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // Update boost flame visual
    if (boostFlameRef.current) {
      boostFlameRef.current.visible = boostActive.current;
      if (boostActive.current) {
         // Flicker effect
         boostFlameRef.current.scale.setScalar(1 + Math.random() * 0.2);
      }
    }

  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        position={startPosition}
        rotation={[0, startRotationY, 0]}
        mass={CAR_MASS}
        gravityScale={0}
        friction={0.6}
        restitution={0.2}
        linearDamping={0.3}
        angularDamping={0.8}
        colliders={false}
        name={`car-${name}`}
        enabledRotations={[true, true, true]}
        onCollisionEnter={(payload) => {
          if (payload.other.rigidBodyObject?.name?.startsWith('car-') || payload.other.rigidBodyObject?.name?.startsWith('wall-')) {
            // Rate limit bumps to avoid audio spam
            const now = performance.now();
            if (now - (window as any).lastBumpTime > 200 || !(window as any).lastBumpTime) {
              audioManager.playHit(20);
              (window as any).lastBumpTime = now;
            }
          }
        }}
      >
        <CuboidCollider args={[CAR_WIDTH / 2, CAR_HEIGHT / 2, CAR_LENGTH / 2]} position={[0, CAR_HEIGHT / 2, 0]} />
      </RigidBody>

      {/* Car Visual */}
      <group ref={meshGroupRef}>
        
        {/* Nameplate */}
        <Html position={[0, CAR_HEIGHT * 2.5, 0]} center sprite transform={false}>
          <div style={{
            color: teamColor,
            textShadow: `0 0 5px ${emissiveColor}, 0 0 10px ${emissiveColor}`,
            fontWeight: 900,
            fontSize: '1.2rem',
            fontFamily: 'system-ui, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            pointerEvents: 'none',
            userSelect: 'none'
          }}>
            {name}
          </div>
        </Html>

        {/* Main body */}
        <mesh position={[0, CAR_HEIGHT * 0.5, 0]} castShadow>
          <boxGeometry args={[CAR_WIDTH, CAR_HEIGHT, CAR_LENGTH]} />
          <meshStandardMaterial
            color={teamColor}
            emissive={emissiveColor}
            emissiveIntensity={supersonicRef.current ? 0.8 : 0.2}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>

        {/* Windshield */}
        <mesh position={[0, CAR_HEIGHT * 0.85, -CAR_LENGTH * 0.15]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[CAR_WIDTH * 0.85, CAR_HEIGHT * 0.4, CAR_LENGTH * 0.25]} />
          <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.1} opacity={0.8} transparent />
        </mesh>

        {/* Front bumper */}
        <mesh position={[0, CAR_HEIGHT * 0.25, -CAR_LENGTH * 0.55]}>
          <boxGeometry args={[CAR_WIDTH * 1.05, CAR_HEIGHT * 0.4, CAR_LENGTH * 0.15]} />
          <meshStandardMaterial color={teamColor} emissive={emissiveColor} emissiveIntensity={0.3} metalness={0.7} roughness={0.2} />
        </mesh>

        {/* Wheels */}
        {[
          [-CAR_WIDTH * 0.5, 0.15, -CAR_LENGTH * 0.3],
          [CAR_WIDTH * 0.5, 0.15, -CAR_LENGTH * 0.3],
          [-CAR_WIDTH * 0.5, 0.15, CAR_LENGTH * 0.3],
          [CAR_WIDTH * 0.5, 0.15, CAR_LENGTH * 0.3],
        ].map((pos, i) => (
          <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
            <meshStandardMaterial color="#111111" emissive={emissiveColor} emissiveIntensity={1.5} toneMapped={false} metalness={0.3} roughness={0.8} />
          </mesh>
        ))}
        {/* Headlights */}
        <mesh position={[-CAR_WIDTH * 0.3, CAR_HEIGHT * 0.5, -CAR_LENGTH * 0.52]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial emissive="#ffffff" emissiveIntensity={1.5} color="#ffff99" />
        </mesh>
        <mesh position={[CAR_WIDTH * 0.3, CAR_HEIGHT * 0.5, -CAR_LENGTH * 0.52]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial emissive="#ffffff" emissiveIntensity={1.5} color="#ffff99" />
        </mesh>

        {/* Taillights */}
        <mesh ref={taillightLeftRef} position={[-CAR_WIDTH * 0.35, CAR_HEIGHT * 0.4, CAR_LENGTH * 0.52]}>
          <boxGeometry args={[0.3, 0.15, 0.05]} />
          <meshStandardMaterial emissive="#ff0000" emissiveIntensity={1} color="#ff0000" />
        </mesh>
        <mesh ref={taillightRightRef} position={[CAR_WIDTH * 0.35, CAR_HEIGHT * 0.4, CAR_LENGTH * 0.52]}>
          <boxGeometry args={[0.3, 0.15, 0.05]} />
          <meshStandardMaterial emissive="#ff0000" emissiveIntensity={1} color="#ff0000" />
        </mesh>

        {/* Tire Tracks (Trails) */}
        <Trail width={0.3} length={30} color={new THREE.Color(teamColor)} attenuation={(t) => t * t} decay={1}>
          <mesh position={[-CAR_WIDTH * 0.5, 0.15, CAR_LENGTH * 0.3]} visible={false} />
        </Trail>
        <Trail width={0.3} length={30} color={new THREE.Color(teamColor)} attenuation={(t) => t * t} decay={1}>
          <mesh position={[CAR_WIDTH * 0.5, 0.15, CAR_LENGTH * 0.3]} visible={false} />
        </Trail>

        {/* Name tag */}
        {/* Will be rendered via HTML overlay */}
        {/* Boost Flame */}
        <mesh ref={boostFlameRef} position={[0, CAR_HEIGHT * 0.4, CAR_LENGTH * 0.5 + 0.5]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
          <coneGeometry args={[0.5, 2, 16]} />
          <meshBasicMaterial color="#ffaa00" transparent opacity={0.8} />
          {/* Inner hotter flame */}
          <mesh position={[0, -0.2, 0]}>
             <coneGeometry args={[0.2, 1.5, 16]} />
             <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
        </mesh>
      </group>
    </>
  );
});

Car.displayName = 'Car';
export default Car;
