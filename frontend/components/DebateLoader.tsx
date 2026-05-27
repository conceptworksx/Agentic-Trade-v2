import {
  TbMessageCircleCheck,
  TbMessageCircleX,
  TbMessageCircleBolt,
  TbMessageCircleExclamation,
} from "react-icons/tb";

import { RiRobot3Line } from "react-icons/ri";

export default function DebateLoader() {
  const icons = [
    <TbMessageCircleCheck key="check" />,
    <TbMessageCircleX key="x" />,
    <TbMessageCircleBolt key="bolt" />,
    <TbMessageCircleExclamation key="excl" />,
  ];

  return (
    <div className="debate mx-auto my-4">
      <div className="robot left">
        <RiRobot3Line />
      </div>

      <div className="robot right">
        <RiRobot3Line />
      </div>

      {icons.map((Icon, i) => (
        <div
          key={i}
          className={`message m${i + 1}`}
        >
          {Icon}
        </div>
      ))}
    </div>
  );
}
