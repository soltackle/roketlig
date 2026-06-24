// ============================================
// CAR - Physics-enabled Car with Full RL Mechanics
// ============================================
import { useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
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

    // Simple ground check: if y position is near ground level
    const groundThreshold = CAR_HEIGHT * 0.8 + 0.3;
    if (pos.y <= groundThreshold) {
      return true;
    }

    // Raycast downward
    const origin = { x: pos.x, y: pos.y, z: pos.z };
    const direction = { x: 0, y: -1, z: 0 };
    const ray = world.castRay(
      { origin, dir: direction } as any,
      CAR_HEIGHT + 0.5,
      true,
      undefined,
      undefined,
      undefined,
      rigidBodyRef.current
    );

    return ray !== null && ray.timeOfImpact < CAR_HEIGHT + 0.3;
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
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
    isGrounded.current = checkGrounded();
    const onGround = isGrounded.current;

    // Update jump timer
    if (jumpTimer.current > 0) {
      jumpTimer.current -= delta;
      if (jumpTimer.current <= 0) {
        jumpTimer.current = 0;
        if (jumpsLeft.current === 1) {
          jumpsLeft.current = 0; // Dodge window expired
        }
      }
    }

    // Reset jumps when grounded
    if (onGround) {
      jumpsLeft.current = MAX_JUMPS;
      jumpTimer.current = 0;
    }

    const maxSpeed = input.boost && boost.current > 0 ? CAR_BOOST_MAX_SPEED : CAR_MAX_SPEED;

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
        const turnMultiplier = Math.min(1, speed / 10); // Less turning at low speed
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

      // Keep car upright on ground
      const euler = new THREE.Euler().setFromQuaternion(quat);
      if (Math.abs(euler.x) > 0.1 || Math.abs(euler.z) > 0.1) {
        const correctedQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(euler.x * 0.9, euler.y, euler.z * 0.9)
        );
        rb.setRotation({ x: correctedQuat.x, y: correctedQuat.y, z: correctedQuat.z, w: correctedQuat.w }, true);
      }
    } else {
      // Air control
      if (input.left) {
        rb.applyTorqueImpulse({ x: 0, y: CAR_AIR_TURN_SPEED * CAR_MASS * delta, z: 0 }, true);
      }
      if (input.right) {
        rb.applyTorqueImpulse({ x: 0, y: -CAR_AIR_TURN_SPEED * CAR_MASS * delta, z: 0 }, true);
      }
      // Air roll
      if (input.airRollLeft) {
        rb.applyTorqueImpulse({ x: 0, y: 0, z: CAR_AIR_TURN_SPEED * CAR_MASS * delta }, true);
      }
      if (input.airRollRight) {
        rb.applyTorqueImpulse({ x: 0, y: 0, z: -CAR_AIR_TURN_SPEED * CAR_MASS * delta }, true);
      }
      // Pitch control in air
      if (input.forward) {
        rb.applyTorqueImpulse({ x: -CAR_AIR_TURN_SPEED * CAR_MASS * delta * 0.5, y: 0, z: 0 }, true);
      }
      if (input.backward) {
        rb.applyTorqueImpulse({ x: CAR_AIR_TURN_SPEED * CAR_MASS * delta * 0.5, y: 0, z: 0 }, true);
      }
    }

    // === BOOST ===
    boostActive.current = false;
    if (input.boost && boost.current > 0) {
      if (!wasJumpPressed.current && !supersonicRef.current) {
         // Optionally check for first frame of boost to play start sound
         // We can simplify and just rely on engine update for now, or track wasBoosting.
      }
      boost.current = Math.max(0, boost.current - BOOST_CONSUMPTION_RATE * delta);
      const boostDir = forward.clone().multiplyScalar(BOOST_FORCE * CAR_MASS * delta);
      rb.applyImpulse({ x: boostDir.x, y: boostDir.y, z: boostDir.z }, true);
      boostActive.current = true;
    }

    // === JUMP ===
    if (input.jump && !wasJumpPressed.current) {
      if (onGround && jumpsLeft.current === MAX_JUMPS) {
        // First jump
        rb.applyImpulse({ x: 0, y: JUMP_FORCE * CAR_MASS, z: 0 }, true);
        jumpsLeft.current = 1;
        jumpTimer.current = DODGE_TIMER;
        lastJumpTime.current = performance.now();
        if (name === 'Player') audioManager.playJump();
      } else if (!onGround && jumpsLeft.current === 1 && jumpTimer.current > 0) {
        // Dodge/flip or double jump
        const hasDirection = input.forward || input.backward || input.left || input.right;
        if (hasDirection) {
          // Dodge in direction
          let dodgeX = 0;
          let dodgeZ = 0;
          if (input.forward) dodgeZ = -1;
          if (input.backward) dodgeZ = 1;
          if (input.left) dodgeX = -1;
          if (input.right) dodgeX = 1;

          const dodgeDir = new THREE.Vector3(dodgeX, 0, dodgeZ).normalize().applyQuaternion(quat);
          rb.applyImpulse(
            { x: dodgeDir.x * DODGE_FORCE * CAR_MASS, y: 2 * CAR_MASS, z: dodgeDir.z * DODGE_FORCE * CAR_MASS },
            true
          );
          // Apply torque for flip animation
          rb.applyTorqueImpulse(
            { x: dodgeZ * DODGE_TORQUE * CAR_MASS, y: 0, z: -dodgeX * DODGE_TORQUE * CAR_MASS },
            true
          );
          if (name === 'Player') audioManager.playDodge();
        } else {
          // Double jump (straight up)
          rb.applyImpulse({ x: 0, y: DOUBLE_JUMP_FORCE * CAR_MASS, z: 0 }, true);
          if (name === 'Player') audioManager.playJump();
        }
        jumpsLeft.current = 0;
        jumpTimer.current = 0;
      }
    }
    wasJumpPressed.current = input.jump;

    // === SUPERSONIC CHECK ===
    supersonicRef.current = speed >= SUPERSONIC_SPEED;

    // Damping angular velocity on ground to prevent spinning
    if (onGround) {
      const angvel = rb.angvel();
      rb.setAngvel({ x: angvel.x * 0.9, y: angvel.y * 0.95, z: angvel.z * 0.9 }, true);
    }
    
    // Update engine sound for player
    if (name === 'Player') {
      audioManager.updateEngine(speed, boostActive.current);
    }
  }

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || !meshGroupRef.current) return;

    // Handle demolition timer
    if (demolished.current) {
      demolishTimer.current -= delta;
      if (demolishTimer.current <= 0) {
        demolished.current = false;
        // Will be reset by game manager
      }
      return;
    }

    // Sync visual mesh with physics
    const pos = rigidBodyRef.current.translation();
    const rot = rigidBodyRef.current.rotation();
    meshGroupRef.current.position.set(pos.x, pos.y, pos.z);
    meshGroupRef.current.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        position={startPosition}
        rotation={[0, startRotationY, 0]}
        mass={CAR_MASS}
        friction={0.6}
        restitution={0.2}
        linearDamping={0.3}
        angularDamping={0.8}
        colliders={false}
        name={`car-${name}`}
        enabledRotations={[true, true, true]}
      >
        <CuboidCollider args={[CAR_WIDTH / 2, CAR_HEIGHT / 2, CAR_LENGTH / 2]} position={[0, CAR_HEIGHT / 2, 0]} />
      </RigidBody>

      {/* Car Visual */}
      <group ref={meshGroupRef}>
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

        {/* Rear spoiler */}
        <mesh position={[0, CAR_HEIGHT * 1.1, CAR_LENGTH * 0.4]}>
          <boxGeometry args={[CAR_WIDTH * 0.9, 0.08, 0.4]} />
          <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Spoiler supports */}
        <mesh position={[-CAR_WIDTH * 0.35, CAR_HEIGHT * 0.9, CAR_LENGTH * 0.4]}>
          <boxGeometry args={[0.08, CAR_HEIGHT * 0.3, 0.08]} />
          <meshStandardMaterial color="#333333" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[CAR_WIDTH * 0.35, CAR_HEIGHT * 0.9, CAR_LENGTH * 0.4]}>
          <boxGeometry args={[0.08, CAR_HEIGHT * 0.3, 0.08]} />
          <meshStandardMaterial color="#333333" metalness={0.7} roughness={0.3} />
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
            <meshStandardMaterial color="#111111" metalness={0.3} roughness={0.8} />
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
        <mesh position={[-CAR_WIDTH * 0.35, CAR_HEIGHT * 0.4, CAR_LENGTH * 0.52]}>
          <boxGeometry args={[0.3, 0.15, 0.05]} />
          <meshStandardMaterial emissive="#ff0000" emissiveIntensity={1} color="#ff0000" />
        </mesh>
        <mesh position={[CAR_WIDTH * 0.35, CAR_HEIGHT * 0.4, CAR_LENGTH * 0.52]}>
          <boxGeometry args={[0.3, 0.15, 0.05]} />
          <meshStandardMaterial emissive="#ff0000" emissiveIntensity={1} color="#ff0000" />
        </mesh>

        {/* Name tag */}
        {/* Will be rendered via HTML overlay */}
      </group>
    </>
  );
});

Car.displayName = 'Car';
export default Car;
