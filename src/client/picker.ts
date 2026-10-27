import { PLANES, PLANE_ORDER, PX_PER_MACH } from '../shared/planes';
import type { Faction } from '../shared/types';
import { shapeSvg } from './shapes';

const FLAGS: Record<Faction, { label: string; svg: string }> = {
  usa: {
    label: 'United States',
    svg: `<svg class="flag" viewBox="0 0 190 100" preserveAspectRatio="none">
      <rect width="190" height="100" fill="#b22234"/>
      ${[1, 3, 5, 7, 9, 11].map((i) => `<rect y="${(i * 100) / 13}" width="190" height="${100 / 13}" fill="#fff"/>`).join('')}
      <rect width="76" height="${(7 * 100) / 13}" fill="#3c3b6e"/>
    </svg>`,
  },
  russia: {
    label: 'Russia',
    svg: `<svg class="flag" viewBox="0 0 3 2" preserveAspectRatio="none">
      <rect width="3" height="2" fill="#d52b1e"/>
      <rect width="3" height="1.333" fill="#0039a6"/>
      <rect width="3" height="0.667" fill="#fff"/>
    </svg>`,
  },
  china: {
    label: 'China',
    svg: `<svg class="flag" viewBox="0 0 30 20" preserveAspectRatio="none">
      <rect width="30" height="20" fill="#ee1c25"/>
      <circle cx="5" cy="5" r="3" fill="#ffff00"/>
    </svg>`,
  },
};

// Bars are relative to the best plane in each stat.
function bars(id: string): string {
  const all = PLANE_ORDER.map((p) => PLANES[p]);
  const best = (f: (s: (typeof all)[number]) => number) => Math.max(...all.map(f));
  const s = PLANES[id];
  const rows: [string, number][] = [
    ['Speed', s.maxSpeed / best((p) => p.maxSpeed)],
    ['Agility', s.turnRate / best((p) => p.turnRate)],
    ['Armor', s.maxHp / best((p) => p.maxHp)],
    ['Missiles', s.missiles / best((p) => p.missiles)],
  ];
  return rows.map(([k, v]) => `<span>${k}</span><div class="bar"><span style="width:${Math.round(v * 100)}%"></span></div>`).join('');
}

/** Renders the plane cards and calls onPick when the player presses Enter. */
export function setupPicker(onPick: (name: string, planeId: string) => void): void {
  const root = document.getElementById('planes')!;
  const nameInput = document.getElementById('name') as HTMLInputElement;
  let selected = load('skyfrost:plane', PLANE_ORDER[0]);
  if (!PLANES[selected]) selected = PLANE_ORDER[0];
  nameInput.value = load('skyfrost:name', '');

  root.innerHTML = PLANE_ORDER.map((id) => {
    const s = PLANES[id];
    const flag = FLAGS[s.faction];
    return `<div class="plane" data-id="${id}">
      ${shapeSvg(id, '#' + s.color.toString(16).padStart(6, '0'))}
      <h2>${s.name}</h2>
      <div class="stats">${bars(id)}</div>
      <p class="country">Top speed Mach ${(s.maxSpeed / PX_PER_MACH).toFixed(1)} · ${s.maxHp} HP</p>
      <p class="skill">${s.skillName}</p>
      ${flag.svg}
      <span class="country">${flag.label}</span>
    </div>`;
  }).join('');

  const cards = [...root.querySelectorAll<HTMLElement>('.plane')];
  const render = () => cards.forEach((c) => c.classList.toggle('selected', c.dataset.id === selected));
  cards.forEach((c) =>
    c.addEventListener('click', () => {
      selected = c.dataset.id!;
      render();
      nameInput.focus();
    }),
  );
  render();
  nameInput.focus();

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const i = PLANE_ORDER.indexOf(selected);
      const step = e.key === 'ArrowRight' ? 1 : -1;
      selected = PLANE_ORDER[(i + step + PLANE_ORDER.length) % PLANE_ORDER.length];
      render();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      window.removeEventListener('keydown', onKey);
      const name = nameInput.value.trim();
      save('skyfrost:name', name);
      save('skyfrost:plane', selected);
      document.getElementById('join')!.remove();
      onPick(name, selected);
    }
  };
  window.addEventListener('keydown', onKey);
}

// Storage can be blocked; remembering choices is only a convenience.
function load(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore.
  }
}
