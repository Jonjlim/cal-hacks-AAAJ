import { requestLock } from '../app/input';
import { useGameStore } from '../store/useGameStore';

/** Title screen and pause overlay (pointer lock needs a user gesture to start). */
export function Overlays() {
  const started = useGameStore((s) => s.started);
  const paused = useGameStore((s) => s.paused);
  const start = useGameStore((s) => s.start);
  const setPaused = useGameStore((s) => s.setPaused);

  if (!started) {
    return (
      <div className="overlay title">
        <div className="card">
          <h1>INSIDE THE MACHINE</h1>
          <p className="tagline">Enter the network. Follow the signal. Discover how AI works.</p>
          <p>
            You are <b>Echo</b>, a digital explorer standing at the Input Gate of a neural network expanded into a
            world. Walk the highways between computational hubs, pull back to see the whole network, and send a prompt
            through it.
          </p>
          <div className="keys">
            <span><kbd>WASD</kbd> move</span>
            <span><kbd>Mouse</kbd> look</span>
            <span><kbd>Shift</kbd> boost</span>
            <span><kbd>Space</kbd> jump</span>
            <span><kbd>F</kbd> energy pulse</span>
            <span><kbd>E</kbd> interact</span>
            <span><kbd>Tab</kbd> network overview</span>
            <span><kbd>P</kbd> prompt</span>
            <span><kbd>R</kbd> respawn</span>
            <span><kbd>Esc</kbd> pause</span>
          </div>
          <button
            className="primary big"
            onClick={() => {
              start();
              requestLock();
            }}
          >
            Enter the network
          </button>
          <small>Prompt processing in this build is an artistic simulation, not real model inference.</small>
        </div>
      </div>
    );
  }
  if (paused) {
    return (
      <div
        className="overlay pause"
        onClick={() => {
          setPaused(false);
          requestLock();
        }}
      >
        <div className="card small">
          <h2>PAUSED</h2>
          <p>Click to resume</p>
        </div>
      </div>
    );
  }
  return null;
}
