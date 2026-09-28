import { useState } from 'react';
import AssistantLauncher from './AssistantLauncher';
import AssistantPanel from './AssistantPanel';
import './widget.css';

// The one component the host page (or, later, the iframe embed) needs to
// mount. Everything else lives underneath it.
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rl-widget-root">
      {open ? (
        <AssistantPanel onClose={() => setOpen(false)} />
      ) : (
        <AssistantLauncher onOpen={() => setOpen(true)} />
      )}
    </div>
  );
}
