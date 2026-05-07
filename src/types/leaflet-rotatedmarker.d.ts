import "leaflet";
import "react-leaflet";

declare module "react-leaflet" {
  import { Icon } from "leaflet";

  export interface MarkerProps {
    rotationAngle?: number;
    rotationOrigin?: string;
    icon?: Icon;
  }
}

