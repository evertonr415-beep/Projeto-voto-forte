"use client";

import { useLayoutEffect } from "react";

const STYLE_ID = "vf-mobile-map-controls-style";
const MOBILE_QUERY = "(max-width: 760px)";

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
