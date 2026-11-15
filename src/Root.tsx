import React from "react";
import { Composition } from "remotion";
import { KopenickShort, SHORT_FRAMES } from "./videos/kopenick/Short";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="KopenickShort" component={KopenickShort} durationInFrames={SHORT_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
