import * as THREE from 'three';

export function makeFurniture(b) {
  const solid = { solid: true };
  b.box('darkWood', [5, 2.2, -5], [12, 0.8, 20], { ...solid, name: 'Кровать' });
  for (const x of [-0.2, 10.2]) {
    for (const z of [-13, 3]) b.box('wood', [x, 1, z], [0.65, 2, 0.65], solid);
  }
  b.box('wood', [5, 3.1, -15.2], [12.4, 5, 0.55], solid);
  b.box('wood', [5, 1.75, 5.1], [12.4, 3.5, 0.45], { ...solid, name: 'Изножье' });
  b.box('sheet', [5, 2.95, -5], [11.8, 0.85, 19.6], { ...solid, name: 'Матрас' });
  b.box('sheet', [5, 3.4, -5], [11.6, 0.18, 19.3], solid);
  for (const x of [2, 7.4])
    b.ball('sheet', [x, 3.7, -12.8], [2.35, 0.58, 1.6], { ...solid, name: 'Подушка' });
  for (let i = 0; i < 14; i++) b.box('wood', [-0.8 + i * 0.9, 4, -15.5], [0.12, 2.4, 0.18]);

  b.box('darkWood', [-14, 0.9, 6], [7.8, 0.8, 11], { ...solid, name: 'Диван' });
  b.box('sofa', [-17.3, 2.8, 6], [1.3, 4, 11], solid);
  for (const z of [1.1, 10.9]) b.box('sofa', [-14, 2.3, z], [7.8, 2.5, 1.2], solid);
  for (let i = 0; i < 3; i++) b.box('sofa', [-13.6, 1.8, 2.7 + i * 3.2], [6, 1.2, 3.05], solid);
  b.ball('cloth', [-15.8, 3, 3.3], [0.7, 1.5, 1.3], { rotation: [0, 0, -0.2] });
  b.ball('sheet', [-15.9, 3, 8.4], [0.65, 1.35, 1.3]);
  for (const x of [-16.7, -11.3])
    for (const z of [1.5, 10.5]) b.box('wood', [x, 0.4, z], [0.45, 0.8, 0.45], solid);

  b.box('wood', [-9, 4.4, -19], [10, 0.4, 6], { ...solid, name: 'Письменный стол' });
  for (const x of [-13, -5])
    for (const z of [-21.3, -16.8]) b.box('wood', [x, 2.1, z], [0.5, 4.2, 0.5], solid);
  b.box('darkWood', [-9, 2.6, -13.5], [3.5, 0.45, 3.5], { ...solid, name: 'Стул' });
  b.box('wood', [-9, 4.3, -12], [3.5, 3.3, 0.35], solid);
  for (const x of [-10.4, -7.6])
    for (const z of [-14.8, -12.2]) b.box('wood', [x, 1.2, z], [0.32, 2.4, 0.32], solid);
  b.box('paper', [-7, 4.64, -18], [2.9, 0.04, 2.1], { rotation: [0, 0.25, 0] });
  b.add('cylinder', 'ceramic', [-11, 5.1, -18.7], [0.57, 0.9, 0.57], { name: 'Кружка' });
  b.add(new THREE.TorusGeometry(0.4, 0.11, 8, 20), 'ceramic', [-10.4, 5.1, -18.7], [1, 1, 1]);
  b.add('cylinder', 'darkWood', [-11, 5.57, -18.7], [0.48, 0.02, 0.48]);

  b.box('darkWood', [-18, 5, -12], [2.8, 10, 12], { name: 'Книжная полка' });
  for (const z of [-18, -6]) b.box('wood', [-17, 5, z], [4, 10, 0.3], solid);
  for (let i = 0; i < 5; i++) b.box('wood', [-17, 0.3 + i * 2.35, -12], [4, 0.3, 12], solid);
  const bookGeo = new THREE.BoxGeometry(0.8, 1.6, 0.42);
  const books = new THREE.InstancedMesh(bookGeo, b.materials.paper, 96);
  const dummy = new THREE.Object3D();
  const colors = [0x647a81, 0xa96d51, 0xa4a17f, 0x4b5e52, 0x836166];
  for (let i = 0; i < 96; i++) {
    dummy.position.set(-16.4, 1.25 + Math.floor(i / 24) * 2.35, -17.4 + (i % 24) * 0.46);
    dummy.rotation.x = Math.sin(i * 2.4) * 0.06;
    dummy.scale.set(1.4, 0.85 + Math.sin(i) * 0.12, 1);
    dummy.updateMatrix();
    books.setMatrixAt(i, dummy.matrix);
    books.setColorAt(i, new THREE.Color(colors[i % colors.length]));
  }
  books.castShadow = true;
  b.scene.add(books);

  b.box('wood', [16, 6.1, -17], [7.5, 12.2, 9], { ...solid, name: 'Шкаф' });
  for (const z of [-19.2, -14.8]) {
    b.box('darkWood', [12.16, 6.2, z], [0.12, 11.5, 4.25]);
    b.box('brass', [12.02, 6, z + (z < -17 ? 1.4 : -1.4)], [0.12, 0.9, 0.13]);
  }
  b.box('wood', [14, 1.8, 9], [5.5, 3.6, 5.2], { ...solid, name: 'Тумбочка' });
  for (let i = 0; i < 3; i++) {
    b.box('darkWood', [11.2, 0.7 + i * 1.05, 9], [0.1, 0.9, 4.6]);
    b.box('brass', [11.05, 0.7 + i * 1.05, 9], [0.16, 0.12, 1]);
  }
  b.add('cylinder', 'brass', [15, 3.75, 9.8], [0.9, 0.18, 0.9]);
  b.add('cylinder', 'brass', [15, 5, 9.8], [0.08, 2.5, 0.08]);
  b.add(
    new THREE.CylinderGeometry(0.8, 1.4, 1.8, 32, 1, true),
    'shade',
    [15, 6.1, 9.8],
    [1, 1, 1],
    { name: 'Лампа' },
  );
  b.box('black', [13, 3.72, 8], [1.3, 0.16, 2.5], { name: 'Телефон' });
  b.box('phone', [13, 3.81, 8], [1.15, 0.02, 2.25]);
  for (let i = 0; i < 3; i++) b.box('glow', [13, 3.825, 7.4 + i * 0.4], [0.8, 0.005, 0.06]);
  b.tube(
    'black',
    [
      [13, 3.7, 9.3],
      [12.3, 3.7, 10.8],
      [11, 2, 11.7],
      [11, 0.05, 14],
      [16, 0.05, 14],
      [19.7, 0.3, 13],
    ],
    0.055,
  );
  b.tube(
    'black',
    [
      [-11, 4.65, -20],
      [-14, 4.5, -21],
      [-14.5, 1, -20],
      [-12, 0.07, -15],
      [-5, 0.07, -11],
    ],
    0.06,
  );
  for (let i = 0; i < 5; i++)
    b.box(i % 2 ? 'cloth' : 'paper', [12.9, 0.12 + i * 0.19, 15], [2.6, 0.18, 3.6], {
      rotation: [0, i * 0.07, 0],
      solid: true,
    });
  for (const x of [8, 10]) {
    b.ball('sofa', [x, 0.22, 12], [0.7, 0.25, 1.6], { ...solid, name: 'Тапок' });
    b.ball('cloth', [x, 0.52, 11.5], [0.72, 0.45, 0.8], solid);
  }
  b.box('rug', [0, 0.04, 12], [15, 0.08, 12], { ...solid, name: 'Ковёр' });
  for (let i = 0; i < 30; i++) {
    b.box('paper', [-7.3 + i * 0.5, 0.08, 18.1], [0.045, 0.03, 0.6]);
    b.box('paper', [-7.3 + i * 0.5, 0.08, 5.9], [0.045, 0.03, 0.6]);
  }
}
