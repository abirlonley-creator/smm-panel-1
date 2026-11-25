import React from "react";

/**
 * Editorial line-art illustration anchored to the bottom-right of the auth split card,
 * pairing clean architectural/studio silhouettes with pastel slate, coral, and sage accents.
 */
export function AuthIllustration() {
  return (
    <svg
      viewBox="0 0 540 340"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto block select-none pointer-events-none"
      aria-hidden="true"
    >
      {/* Far-right soft mint studio tower */}
      <path
        d="M428 340V144L492 126V340H428Z"
        fill="#DCEAE2"
      />
      <path
        d="M428 144L492 126V340"
        stroke="#27474E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M446 158V214M460 154V210M474 150V206"
        stroke="#27474E"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Left-side soft blue angled studio tower */}
      <path
        d="M28 340V220L88 232V340H28Z"
        fill="#D6E4EC"
      />
      <path
        d="M88 340V232L116 224V340H88Z"
        fill="#FFFFFF"
      />
      <path
        d="M28 340V220L88 232L116 224V340"
        stroke="#27474E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M88 232V340" stroke="#27474E" strokeWidth="2.2" />
      <path
        d="M44 244L72 250M44 260L72 266M44 276L72 282M44 292L72 298"
        stroke="#27474E"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Mid-left tall white editorial frame */}
      <path
        d="M84 340L128 142L192 120L214 134V340H84Z"
        fill="#FFFFFF"
      />
      <path
        d="M192 120L214 134V340"
        fill="#DCEAE2"
      />
      <path
        d="M84 340L128 142L192 120L214 134V340M192 120V340"
        stroke="#27474E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Vertical metric ribs */}
      <path
        d="M142 152L114 282M156 146L128 282M170 140L142 282M182 136L158 260"
        stroke="#27474E"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Coral / peach growth card block */}
      <path
        d="M174 340V200L248 186V340H174Z"
        fill="#F6CFC7"
      />
      <path
        d="M248 340V186L278 198V340H248Z"
        fill="#FFFFFF"
      />
      <path
        d="M174 340V200L248 186L278 198V340M248 186V340"
        stroke="#27474E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* S-Curve / progress stripes inside coral card */}
      <path
        d="M190 218L234 209M190 232L234 223M190 246L234 237M190 260L234 251M190 274L234 265M190 288L234 279"
        stroke="#27474E"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Center crisp analytics tower */}
      <path
        d="M276 340V146L348 134V340H276Z"
        fill="#FFFFFF"
      />
      <path
        d="M348 340V134L368 144V340H348Z"
        fill="#D6E4EC"
      />
      <path
        d="M276 340V146L348 134L368 144V340M348 134V340"
        stroke="#27474E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dotted data bar windows */}
      {[160, 182, 204, 226, 248].map((y) => (
        <g key={y}>
          <path
            d={`M292 ${y}V${y + 12}M306 ${y - 2}V${y + 10}M320 ${y - 4}V${y + 8}M334 ${y - 6}V${y + 6}`}
            stroke="#27474E"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* Tall flagship white prism on the right */}
      <path
        d="M356 340V64L426 30V340H356Z"
        fill="#FFFFFF"
      />
      <path
        d="M426 340V30L510 74V340H426Z"
        fill="#FFFFFF"
      />
      <path
        d="M356 340V64L426 30L510 74V340M426 30V340"
        stroke="#27474E"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Upper window bars */}
      {[74, 96, 118, 140, 162, 184].map((y, i) => (
        <g key={y}>
          <path
            d={`M374 ${y}V${y + 12}M388 ${y - 6}V${y + 6}M402 ${y - 12}V${y}`}
            stroke="#27474E"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {i < 5 && (
            <path
              d={`M444 ${y - 2}L492 ${y + 16}`}
              stroke="#27474E"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>
      ))}

      {/* Subtle upward organic growth curve overlay connecting towers */}
      <path
        d="M52 204C116 196 154 114 218 118C272 122 308 86 356 50"
        stroke="#5E8C1F"
        strokeWidth="2.2"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
      <circle cx="356" cy="50" r="5" fill="#D4F04F" stroke="#27474E" strokeWidth="2" />

      {/* Foreground rounded botanical trees (matching the clean trees at the bottom of the reference) */}
      <g>
        <path
          d="M150 326C136 326 126 315 126 302C126 294 130 287 136 283C135 279 135 274 137 270C141 262 151 259 159 263C166 266 170 273 169 281C175 286 178 294 177 302C175 316 164 326 150 326Z"
          fill="#FFFFFF"
          stroke="#27474E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M150 340V296M150 310L160 300M150 304L141 296" stroke="#27474E" strokeWidth="2.2" strokeLinecap="round" />
      </g>

      <g>
        <path
          d="M440 318C422 318 408 304 408 286C408 276 413 266 421 260C420 247 429 235 442 234C455 233 466 243 467 256C474 263 478 273 477 284C475 303 459 318 440 318Z"
          fill="#FFFFFF"
          stroke="#27474E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M441 340V278M441 298L454 285M441 290L429 278" stroke="#27474E" strokeWidth="2.2" strokeLinecap="round" />
      </g>

      <g>
        <path
          d="M498 326C484 326 474 316 474 303C474 295 478 288 484 284C483 275 490 266 499 266C508 266 515 274 515 283C521 288 524 296 523 304C521 317 511 326 498 326Z"
          fill="#FFFFFF"
          stroke="#27474E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M498 340V296M498 310L508 300" stroke="#27474E" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * Subtle watermark pattern rendered onto the outer dark forest green frame,
 * echoing the editorial backdrop from the reference screenshot.
 */
export function AuthBackdropWatermark() {
  return (
    <svg
      viewBox="0 0 1440 900"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.09] select-none"
      aria-hidden="true"
    >
      {/* Left skyline silhouette */}
      <g stroke="#D4F04F" strokeWidth="1.5">
        <path d="M-20 900V620L70 590L130 615V900" />
        <path d="M70 590V900M20 640V840M42 632V840M94 636V840" />
        <path d="M130 900V520L210 490L260 515V900" />
        <path d="M210 490V900M155 545V780M180 536V780" />
      </g>
      {/* Right skyline silhouette */}
      <g stroke="#D4F04F" strokeWidth="1.5">
        <path d="M1180 900V560L1260 530L1320 555V900" />
        <path d="M1260 530V900M1208 585V820M1232 576V820" />
        <path d="M1320 900V480L1410 445L1470 475V900" />
        <path d="M1410 445V900M1352 510V790M1380 500V790" />
      </g>
    </svg>
  );
}
