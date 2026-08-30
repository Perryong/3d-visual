/**
 * Parts list and component data panel.
 *
 * The list is the index into everything else: picking a row, clicking a part
 * in the 3D field and clicking a callout all end up calling the same
 * onSelect, so the three views can never disagree about what is selected.
 */

export function createUI({ onSelect, data }) {
  const { PARTS, GROUPS, PART_BY_ID } = data;
  const list = document.getElementById('bom-list');
  const panel = document.getElementById('data-panel');
  const count = document.getElementById('bom-count');

  // ---- Parts list -------------------------------------------------------
  GROUPS.forEach((group) => {
    const members = PARTS.filter((p) => p.group === group.id);
    if (!members.length) return;

    const heading = document.createElement('li');
    heading.className = 'bom__group';
    heading.textContent = group.label;
    list.appendChild(heading);

    members.forEach((p) => {
      const row = document.createElement('li');
      row.className = 'bom__row';
      row.innerHTML = `
        <button type="button" class="bom__btn" data-part-id="${p.id}">
          <span class="bom__id">${p.id}</span>
          <span class="bom__name">${p.name}</span>
          <span class="bom__qty">${p.qty}</span>
        </button>`;
      list.appendChild(row);
    });
  });

  count.textContent = `${PARTS.length} items`;

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.bom__btn');
    if (btn) onSelect(btn.dataset.partId);
  });

  function setActiveRow(partId) {
    list.querySelectorAll('.bom__btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.partId === partId);
    });
    const active = list.querySelector('.bom__btn.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  // ---- Data panel -------------------------------------------------------
  const EMPTY = `
    <p class="data__empty">
      Nothing selected. Pick a row from the parts list, click a component in
      the 3D field, or drag the disassembly slider to take the vehicle apart.
    </p>`;

  function showPart(partId) {
    const p = PART_BY_ID[partId];
    if (!p) {
      panel.innerHTML = EMPTY;
      return;
    }
    panel.innerHTML = `
      <header class="data__head">
        <span class="data__ref">${p.id}</span>
        <h3 class="data__title">${p.name}</h3>
      </header>
      <dl class="data__grid">
        <dt>Quantity</dt><dd>${p.qty}</dd>
        <dt>Construction</dt><dd>${p.material}</dd>
        <dt>Mass</dt><dd>${p.mass}</dd>
      </dl>
      <section class="data__block">
        <h4>Function</h4>
        <p>${p.spec}</p>
      </section>
      <section class="data__block data__block--note">
        <h4>Maintenance note</h4>
        <p>${p.note}</p>
      </section>`;
  }

  function clear() {
    panel.innerHTML = EMPTY;
    setActiveRow(null);
  }

  clear();

  return { showPart, clear, setActiveRow };
}
