import { useId } from "react";

const PET_COLORS = {
  cat: { coat: "#c99169", shade: "#986849", belly: "#f6e4cf", inner: "#d98786", eye: "#668d78", muzzle: "#f4dfd1", nose: "#9d655f" },
  dog: { coat: "#c88a50", shade: "#98643e", belly: "#f5dfbd", inner: "#9a5d43", eye: "#604735", muzzle: "#f4e8d6", nose: "#4f4039" },
  penguin: { coat: "#556879", shade: "#344652", belly: "#f6f3e8", inner: "#d8974a", eye: "#283139", muzzle: "#f2c464", nose: "#d98d35" },
};

function darken(hex, amount = 0.25) {
  const value = Number.parseInt(hex.slice(1), 16);
  if (!/^#[\da-f]{6}$/i.test(hex) || !Number.isFinite(value)) return hex;
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    .map((channel) => Math.round(channel * (1 - amount)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function Cat({ colors, coat }) {
  return <>
    <path className="pet-tail" d="M133 161 C159 160 167 141 162 119 C158 102 171 96 180 104" fill="none" stroke={coat} strokeWidth="15" strokeLinecap="round" />
    <path d="M136 158 C157 157 163 141 159 125" fill="none" stroke="#e1b58c" strokeWidth="4" strokeLinecap="round" />
    <ellipse cx="101" cy="157" rx="48" ry="57" fill={coat} />
    <ellipse cx="101" cy="161" rx="30" ry="43" fill={colors.belly} />
    <path d="M76 194 Q73 211 60 214 Q50 216 51 208 Q51 202 66 198" fill={coat} />
    <path d="M124 194 Q127 211 140 214 Q150 216 149 208 Q149 202 134 198" fill={coat} />
    <ellipse cx="77" cy="211" rx="19" ry="9" fill={colors.shade} /><ellipse cx="125" cy="211" rx="19" ry="9" fill={colors.shade} />
    <path d="M57 126 Q43 115 41 137 L46 166 Q49 176 60 169 L71 149" fill={coat} />
    <path d="M143 126 Q157 115 159 137 L154 166 Q151 176 140 169 L129 149" fill={coat} />
    <path d="M62 57 L57 18 Q56 9 64 15 L91 41 M139 57 L144 18 Q145 9 137 15 L110 41" fill={coat} stroke={colors.shade} strokeWidth="2" strokeLinejoin="round" />
    <path d="M65 43 L64 25 L80 43 M136 43 L137 25 L121 43" fill={colors.inner} />
    <ellipse cx="101" cy="71" rx="53" ry="46" fill={coat} />
    <path d="M82 42 Q101 50 120 42" fill="none" stroke={colors.shade} strokeWidth="3" strokeLinecap="round" />
    <path d="M88 48 L93 55 M101 45 L103 53 M114 48 L112 55" stroke={colors.shade} strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="80" cy="72" rx="12" ry="15" fill="#fffdf5" /><ellipse cx="122" cy="72" rx="12" ry="15" fill="#fffdf5" />
    <ellipse cx="82" cy="74" rx="5" ry="8" fill={colors.eye} /><ellipse cx="120" cy="74" rx="5" ry="8" fill={colors.eye} />
    <circle cx="83" cy="72" r="2.3" fill="white" /><circle cx="121" cy="72" r="2.3" fill="white" />
    <ellipse className="pet-blink" cx="80" cy="72" rx="12" ry="15" fill={coat} /><ellipse className="pet-blink" cx="122" cy="72" rx="12" ry="15" fill={coat} />
    <ellipse cx="101" cy="91" rx="25" ry="17" fill={colors.muzzle} />
    <path d="M96 85 Q101 79 106 85 Q101 91 96 85" fill={colors.nose} />
    <path className="pet-smile" d="M101 90 Q96 101 89 96 M101 90 Q106 101 113 96" fill="none" stroke="#715249" strokeWidth="2.2" strokeLinecap="round" />
    <ellipse className="pet-open-mouth" cx="101" cy="98" rx="7" ry="8" fill="#743e45" />
    <path d="M73 88 L51 83 M73 94 L51 96 M129 88 L151 83 M129 94 L151 96" stroke={colors.muzzle} strokeWidth="2" strokeLinecap="round" />
  </>;
}

function Dog({ colors, coat }) {
  return <>
    <path className="pet-tail" d="M139 151 Q164 148 164 127 Q164 115 172 112" fill="none" stroke={coat} strokeWidth="16" strokeLinecap="round" />
    <ellipse cx="101" cy="157" rx="49" ry="57" fill={coat} />
    <ellipse cx="101" cy="163" rx="30" ry="42" fill={colors.belly} />
    <path d="M74 194 Q69 209 59 212 Q49 215 52 207 L64 197 M127 194 Q132 209 142 212 Q152 215 149 207 L137 197" fill={coat} />
    <ellipse cx="74" cy="211" rx="20" ry="9" fill={colors.shade} /><ellipse cx="128" cy="211" rx="20" ry="9" fill={colors.shade} />
    <path d="M61 130 Q42 121 48 148 L57 169 Q63 177 72 166 L78 148 M139 130 Q158 121 152 148 L143 169 Q137 177 128 166 L122 148" fill={coat} />
    <ellipse cx="101" cy="72" rx="53" ry="47" fill={coat} />
    <path d="M54 62 Q36 50 38 78 Q39 108 57 111 Q68 104 68 83 M148 62 Q166 50 164 78 Q163 108 145 111 Q134 104 134 83" fill={colors.shade} />
    <path d="M56 61 Q43 55 44 77 Q45 92 57 97 M146 61 Q159 55 158 77 Q157 92 145 97" fill={colors.inner} />
    <ellipse cx="80" cy="73" rx="12" ry="14" fill="#fffdf5" /><ellipse cx="122" cy="73" rx="12" ry="14" fill="#fffdf5" />
    <ellipse cx="82" cy="74" rx="5" ry="8" fill={colors.eye} /><ellipse cx="120" cy="74" rx="5" ry="8" fill={colors.eye} />
    <circle cx="83" cy="72" r="2.3" fill="white" /><circle cx="121" cy="72" r="2.3" fill="white" />
    <ellipse className="pet-blink" cx="80" cy="73" rx="12" ry="14" fill={coat} /><ellipse className="pet-blink" cx="122" cy="73" rx="12" ry="14" fill={coat} />
    <ellipse cx="101" cy="95" rx="31" ry="22" fill={colors.muzzle} />
    <ellipse cx="101" cy="86" rx="9" ry="7" fill={colors.nose} />
    <path className="pet-smile" d="M101 92 Q96 104 88 100 M101 92 Q106 104 114 100" fill="none" stroke="#654a3a" strokeWidth="2.3" strokeLinecap="round" />
    <ellipse className="pet-open-mouth" cx="101" cy="101" rx="8" ry="9" fill="#743e45" />
    <path d="M70 119 Q101 131 132 119" fill="none" stroke={colors.belly} strokeWidth="8" strokeLinecap="round" />
  </>;
}

function Penguin({ colors, coat }) {
  return <>
    <ellipse cx="101" cy="151" rx="52" ry="66" fill={coat} />
    <ellipse cx="101" cy="161" rx="35" ry="49" fill={colors.belly} />
    <path d="M63 192 Q55 208 45 207 Q37 210 45 215 L72 216 Q82 213 79 202 M139 192 Q147 208 157 207 Q165 210 157 215 L130 216 Q120 213 123 202" fill={colors.nose} />
    <path className="pet-flipper pet-flipper-left" d="M55 117 Q37 119 36 148 Q36 172 53 181 Q67 179 72 160" fill={colors.shade} />
    <path className="pet-flipper pet-flipper-right" d="M147 117 Q165 119 166 148 Q166 172 149 181 Q135 179 130 160" fill={colors.shade} />
    <ellipse cx="101" cy="77" rx="52" ry="50" fill={coat} />
    <ellipse cx="101" cy="90" rx="39" ry="32" fill={colors.belly} />
    <ellipse cx="80" cy="73" rx="11" ry="14" fill="#fffdf5" /><ellipse cx="122" cy="73" rx="11" ry="14" fill="#fffdf5" />
    <ellipse cx="82" cy="74" rx="5" ry="8" fill={colors.eye} /><ellipse cx="120" cy="74" rx="5" ry="8" fill={colors.eye} />
    <circle cx="83" cy="71" r="2.2" fill="white" /><circle cx="121" cy="71" r="2.2" fill="white" />
    <ellipse className="pet-blink" cx="80" cy="73" rx="11" ry="14" fill={coat} /><ellipse className="pet-blink" cx="122" cy="73" rx="11" ry="14" fill={coat} />
    <path d="M93 87 Q101 81 109 87 L102 101 Q100 103 98 101 Z" fill={colors.nose} />
    <path className="pet-smile" d="M98 102 Q101 107 104 102" fill="none" stroke="#8a5934" strokeWidth="2" strokeLinecap="round" />
    <ellipse className="pet-open-mouth" cx="101" cy="105" rx="6" ry="7" fill="#c46842" />
    <path d="M71 119 Q101 130 131 119" fill="none" stroke="#d8e0e0" strokeWidth="3" strokeLinecap="round" />
  </>;
}

export default function AnimatedPet({ species, action = "idle", accessoryColor, color }) {
  const instanceId = useId().replaceAll(":", "");
  const baseColors = PET_COLORS[species] || PET_COLORS.cat;
  const coatColor = /^#[\da-f]{6}$/i.test(color || "") ? color : baseColors.coat;
  const colors = { ...baseColors, coat: coatColor, shade: darken(coatColor) };
  const drawPet = { cat: Cat, dog: Dog, penguin: Penguin }[species] || Cat;
  const PetShape = drawPet;
  const gradientId = `pet-coat-${species}-${instanceId}`;
  const coat = `url(#${gradientId})`;

  return (
    <svg className={`animated-pet pet-species-${species} pet-action-${action}`} viewBox="0 0 200 232" aria-hidden="true" focusable="false">
      <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2=".9" y2="1"><stop stopColor={colors.coat} /><stop offset="1" stopColor={colors.shade} /></linearGradient>
      </defs>
      <ellipse className="pet-ground-shadow" cx="101" cy="218" rx="48" ry="8" />
      <g className="pet-character-body">
        <PetShape colors={colors} coat={coat} />
        {accessoryColor && <path className="pet-character-collar" d="M72 119 Q101 130 130 119" style={{ stroke: accessoryColor }} />}
      </g>
    </svg>
  );
}

