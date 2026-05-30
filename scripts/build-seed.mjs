// ─────────────────────────────────────────────────────────────
//  build-seed.mjs
//  Compiles the bundled seed dataset (src/data/seed.json) from the
//  enriched extraction in ../../005/klee-gestaltungslehre and copies
//  the manuscript images into public/manuscripts.
//
//  It injects faithful DE→EN / DE→ES translations of the 22 extracted
//  fragments (the pipeline left [EN]/[ES] placeholders), and fills in
//  EN/ES for the frequency-discovered glossary terms.
//
//  Run:  npm run build:seed
// ─────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.join(__dirname, "..");
const SRC = path.join(PROJECT, "..", "005", "klee-gestaltungslehre");
const ENRICHED = path.join(SRC, "data", "enriched", "pages");
const PUBLIC_IMG = path.join(PROJECT, "public", "manuscripts");
const OUT = path.join(PROJECT, "src", "data", "seed.json");

// ── Faithful translations, keyed by "page-article" ──────────────
// Authored from Klee's German manuscript fragments (BG I.2 "Principielle
// Ordnung", the leaf/articulation lectures of Oct. 1923). Empty / pure
// date / pure footnote-marker articles are left to fall back to the
// original text so nothing is invented.
const T = {
  "1-24": {
    en: "2. Principial order",
    es: "2. Orden principial",
  },
  "2-2": {
    en: "Growth is the locomotion of matter through new formation, added to what remains at rest. Movement in the earthly realm requires energy. Analogously it is so with the stroke of the line and our other pictorial elements — such as plane, or tone and colour, and so forth.",
    es: "El crecimiento es el desplazamiento de la materia mediante nueva formación, sumada a lo que permanece en reposo. El movimiento en el ámbito terrestre requiere energía. De modo análogo ocurre con el trazo de la línea y nuestros demás elementos plásticos — como el plano, o el tono y el color, etcétera.",
  },
  "2-3": {
    en: "The divisions of this line are, in different leaves, ever again different; the case ½ + ½ is at any rate rarer than the cases of unequal division. Different — and yet a certain principal type can be established: stalk shorter, main rib longer.",
    es: "Las divisiones de esta línea son, en las distintas hojas, siempre diferentes; el caso ½ + ½ es, en todo caso, más raro que los casos de división desigual. Diferentes — y sin embargo puede establecerse un cierto tipo principal: pecíolo más corto, nervio central más largo.",
  },
  "2-24": {
    en: "Tuesday, 23 October 1923.",
    es: "Martes, 23 de octubre de 1923.",
  },
  "2-25": {
    en: "A leaf is a part of the whole. If the tree is the organism, then the leaf is the organ. These small parts of the whole are themselves again articulated. In this articulation there reign ideas and relationships of articulation which, in the small, are an image of the articulation of the whole. The articulation of the whole is called: root, trunk, crown. The articulation of the crown is called: bough, branch, leaf, blossom, fruit. The articulation of the leaf is called: stalk, ribs, and leaf-tissue.",
    es: "Una hoja es una parte del todo. Si el árbol es el organismo, entonces la hoja es el órgano. Estas pequeñas partes del todo están a su vez articuladas en sí mismas. En esta articulación rigen ideas y relaciones de articulación que, en lo pequeño, son una imagen de la articulación del todo. La articulación del todo se llama: raíz, tronco, copa. La articulación de la copa se llama: rama, ramo, hoja, flor, fruto. La articulación de la hoja se llama: pecíolo, nervios y tejido foliar.",
  },
  "2-26": {
    en: "Monday, 29 October 1923.",
    es: "Lunes, 29 de octubre de 1923.",
  },
  "2-46": {
    en: "Drawing leaves from nature, taking into account the articulating energies of the leaf-ribs. Connected with this, the attempt at a typology of the division-patterns that differ across the various species.",
    es: "Dibujar hojas del natural teniendo en cuenta las energías articuladoras de los nervios de la hoja. Ligado a ello, el intento de una tipología de los patrones de división que varían según las especies.",
  },
  "2-47": {
    en: "Here leaf, stalk, and ribs belong together — in particular the leaf-stalk and the midrib, so that one may say: the midrib is the continuation of the leaf-stalk. This whole line thus divides into stalk and stalk-continuation.",
    es: "En esto la hoja, el pecíolo y los nervios forman una unidad — en particular el pecíolo y el nervio central, de modo que puede decirse: el nervio central es la prolongación del pecíolo. Toda esta línea se descompone, pues, en pecíolo y prolongación del pecíolo.",
  },
  "3-1": {
    en: "Furthermore the side-ribs in turn undergo an articulation of their own, according to measure and weight; likewise their further branchings to both sides. The stretches and the driving energies diminish more and more, until they can do no more.",
    es: "Además, los nervios laterales experimentan a su vez una articulación propia, según medida y peso; igualmente sus ulteriores ramificaciones hacia ambos lados. Los tramos y las energías impulsoras disminuyen cada vez más, hasta que ya no pueden más.",
  },
  "3-24": {
    en: "This division of the main line stalk–midrib is, however, not the only one. In the simplest type, new divisions arise through the branching of new leaf-ribs to the left and to the right, which articulate the midrib (or the leaf-spine) yet further. Here it is to be observed that the line is charged with particular energy precisely where it has the task of producing as many branchings as possible — namely at the beginning, close to the leaf-stalk. (b)",
    es: "Sin embargo, esta división de la línea principal pecíolo–nervio central no es la única. En el tipo más simple surgen nuevas divisiones mediante la ramificación de nuevos nervios hacia la izquierda y hacia la derecha, que articulan aún más el nervio central (o la arista de la hoja). Cabe observar que la línea está cargada de una energía particular justamente allí donde tiene la tarea de producir el mayor número posible de ramificaciones — a saber, al comienzo, cerca del pecíolo. (b)",
  },
  "3-25": {
    en: "And our pursuing eye, too, can no longer recognize the last-branched lines as such, and gives up the chase. The particles are confusingly small and are no longer felt as line-energies, but as plane-elements.",
    es: "Y también nuestro ojo, al seguirlas, ya no logra reconocer como tales las líneas en su última ramificación, y abandona el seguimiento. Las partículas son desconcertantemente pequeñas y ya no se sienten como energías lineales, sino como elementos de superficie.",
  },
  "3-45": {
    en: "Thus there arise reciprocal relationships between the intervals of the articulation and the strength — or the energy — of the lines. (Relations of measure and relations of weight.)",
    es: "Surgen así relaciones recíprocas entre las distancias de la articulación y la fuerza — o la energía — de las líneas. (Relaciones de medida y relaciones de peso.)",
  },
  "3-46": {
    en: "Returning to the articulation of the main line, the case may also arise in which the branchings occur not oppositely but alternately, whereby the articulation — which in itself is already a bisection of the plane — [further divides] it.",
    es: "Volviendo a la articulación de la línea principal, puede darse también el caso en que las ramificaciones no se dispongan de forma opuesta sino alterna, con lo cual la articulación — que de por sí ya es una bipartición de la superficie — la [divide aún más].",
  },
  "4-2": {
    en: "The connectedness of the leaf-organ — through the stalk — with the branch and with the whole tree never quite permits a co-ordination of equals: even should the side-ribs come to equal the midrib in size, it always remains a matter of symmetry. That is, the supremacy of the central axis is preserved.",
    es: "La vinculación del órgano-hoja — a través del pecíolo — con la rama y con el árbol entero nunca permite del todo una equiparación: aun cuando los nervios laterales llegaran a igualar en tamaño al nervio central, sigue siendo siempre una cuestión de simetría. Es decir, se mantiene la supremacía del eje central.",
  },
  "4-24": {
    en: "The bisection underscores it still further. Left: 4 3 2. For the left side, points 1 and 4 are of lesser value; for the right side, points 1 and 3 are of lesser value.",
    es: "La bipartición lo subraya todavía más. Izquierda: 4 3 2. Para el lado izquierdo, los puntos 1 y 4 son de menor valor; para el lado derecho, los puntos 1 y 3 son de menor valor.",
  },
  "4-25": {
    en: "In principle, a second main type deviates from this one, in that at first two of the side-ribs would like to appropriate to themselves the power of the central ridge.",
    es: "En principio, un segundo tipo principal se aparta de este, en cuanto que, de entrada, dos de los nervios laterales quisieran apropiarse del poder de la arista central.",
  },
  "4-45": {
    en: "It looks still more complicated in leaves where these alternate and opposite articulations appear combined with one another. And yet it is still always the quite primitive basic type.",
    es: "En las hojas la cosa parece aún más complicada, allí donde estas articulaciones alternas y opuestas aparecen combinadas entre sí. Y, sin embargo, sigue siendo siempre el tipo básico, del todo primitivo.",
  },
  "4-46": {
    en: "Namely, these side-branches rise up early for this purpose, and all together begin their independence already at the point which separates the leaf from the leaf-stalk. This example is mostly followed, in turn, by two further ribs.",
    es: "En efecto, estas ramas laterales se yerguen pronto para este fin, y todas juntas comienzan su autonomía ya en el punto que separa la hoja del pecíolo. A este ejemplo le siguen, por lo general, otros dos nervios más.",
  },
  "5-24": {
    en: "Our conception of the ribs as constructive, articulating energies entails that we now think the genesis of the leaf (in the pictorial sense) as a confrontation between linear energy (or singularity) and planar massiveness (or multiplicity).",
    es: "Nuestra concepción de los nervios como energías constructivas y articuladoras lleva consigo pensar ahora la génesis de la hoja (en sentido plástico) como una confrontación entre energía lineal (o singularidad) y masividad superficial (o multiplicidad).",
  },
  "5-25": {
    en: "The plane-form that arises is [illegible] dependent on the intervening linear radiation. And where the linear power ends, the contour forms itself — the boundary of the plane-form. This boundary, if one follows it, is also a line, but it has little to do with the radiant energy of the inner line-formations as an element of clear character.",
    es: "La forma de superficie que surge es [ilegible] dependiente de la radiación lineal que interviene. Y donde termina la potencia lineal se forma el contorno — el límite de la forma de superficie. Este límite, si se lo sigue, es también una línea, pero poco tiene que ver con la energía radiante de las formaciones lineales internas como elemento de carácter claro.",
  },
  "5-45": {
    en: "The planar massiveness is the element which no longer appears linear to the eye, but distinguishes itself as a particular element through its tangle of lines. Against the linear definiteness, this element can make a soft impression. The system of these lines reaches — finely forked, or sieve-like — into the other element, and enough of it will remain caught there.",
    es: "La masividad superficial es el elemento que ya no aparece lineal ante el ojo, sino que se distingue como un elemento particular por su maraña de líneas. Frente a la determinación lineal, este elemento puede producir una impresión suave. El sistema de estas líneas penetra — finamente bifurcado, o a modo de criba — en el otro elemento, y suficiente de ello quedará prendido allí.",
  },
  "5-46": {
    en: "It is not active; it does not act, but is passive — it is suffered. Yet as a form of suffering it gives back reflexes of the linear forms of attack. The more sharply the rays jut out — as in the maple or the plane-tree leaf — the more acute the angles of the boundary line. But if the unfolding of energy takes place more enclosed, then the contour line will run more calmly.",
    es: "No es activa; no actúa, sino que es pasiva — es padecida. Pero, como forma del padecer, devuelve reflejos de las formas lineales de ataque. Cuanto más agudos sobresalen los rayos — como en el arce o en la hoja del plátano —, tanto más agudos son los ángulos de la línea de borde. Pero si el despliegue de energía se realiza de manera más cerrada, la línea de contorno discurrirá con más calma.",
  },
};

// ── EN/ES for frequency-discovered glossary terms ───────────────
const TERM_DICT = {
  Stiel: ["stalk / stem", "pecíolo / tallo"],
  Blatt: ["leaf", "hoja"],
  Element: ["element", "elemento"],
  Energien: ["energies", "energías"],
  Wieder: ["again", "de nuevo"],
  Hauptrippe: ["main rib / midrib", "nervio central"],
  Ganzen: ["the whole", "el todo"],
  Rippen: ["ribs", "nervios"],
  Blattstiel: ["leaf-stalk / petiole", "pecíolo"],
  Einen: ["a / one", "un / uno"],
  Blättern: ["leaves", "hojas"],
  Immer: ["always", "siempre"],
  Heisst: ["is called", "se llama"],
  Seitenrippen: ["side-ribs", "nervios laterales"],
  Abzweigungen: ["branchings", "ramificaciones"],
  Beim: ["at the / with the", "en el / junto al"],
  Linien: ["lines", "líneas"],
  Punkte: ["points", "puntos"],
  Linearen: ["linear", "lineales"],
};

// ── Chapter map (trilingual), full archive structure ────────────
const CHAPTERS = [
  ["BF", null, 0, "Bildnerische Formlehre", "Pictorial Theory of Form", "Teoría pictórica de la forma", "/ee/ZPK/BF/2012/01/01/"],
  ["BG", "I", 1, "Gestaltungslehre als Begriff", "Theory of Design as a Concept", "La teoría de la configuración como concepto", "/ee/ZPK/BG/2012/01/01/"],
  ["BG", "I", 2, "Principielle Ordnung", "Principial Order", "Orden principial", "/ee/ZPK/BG/2012/01/02/"],
  ["BG", "I", 3, "Specielle Ordnung", "Special Order", "Orden especial", "/ee/ZPK/BG/2012/01/03/"],
  ["BG", "I", 4, "Gliederung", "Articulation", "Articulación", "/ee/ZPK/BG/2012/01/04/"],
  ["BG", "II", 5, "Wege zur Form", "Ways to Form", "Caminos hacia la forma", "/ee/ZPK/BG/2012/02/05/"],
  ["BG", "II", 6, "Elementarform", "Elementary Form", "Forma elemental", "/ee/ZPK/BG/2012/02/06/"],
  ["BG", "II", 7, "Form im Format", "Form within the Format", "La forma en el formato", "/ee/ZPK/BG/2012/02/07/"],
  ["BG", "II", 8, "Formvermittlung", "Mediation of Form", "Mediación de la forma", "/ee/ZPK/BG/2012/02/08/"],
  ["BG", "II", 9, "Formgebilde", "Form-Structures", "Configuraciones formales", "/ee/ZPK/BG/2012/02/09/"],
  ["BG", "II", 10, "Zusammengesetzte Form", "Composite Form", "Forma compuesta", "/ee/ZPK/BG/2012/02/10/"],
  ["BG", "II", 11, "Abweichung auf Grund der Norm", "Deviation on the Basis of the Norm", "Desviación sobre la base de la norma", "/ee/ZPK/BG/2012/02/11/"],
  ["BG", "II", 12, "Lagenwechsel", "Change of Position", "Cambio de posición", "/ee/ZPK/BG/2012/02/12/"],
  ["BG", "II", 13, "Irreguläres Formgebilde", "Irregular Form-Structure", "Configuración formal irregular", "/ee/ZPK/BG/2012/02/13/"],
  ["BG", "II", 14, "Mehreinige Centren", "Multiple Unified Centres", "Centros múltiples unificados", "/ee/ZPK/BG/2012/02/14/"],
  ["BG", "II", 15, "Freie Irregularität", "Free Irregularity", "Irregularidad libre", "/ee/ZPK/BG/2012/02/15/"],
  ["BG", "II", 16, "Kegelschnitte", "Conic Sections", "Secciones cónicas", "/ee/ZPK/BG/2012/02/16/"],
  ["BG", "II", 17, "Wandernde Centren", "Wandering Centres", "Centros errantes", "/ee/ZPK/BG/2012/02/17/"],
  ["BG", "II", 18, "Pathologie", "Pathology", "Patología", "/ee/ZPK/BG/2012/02/18/"],
  ["BG", "II", 19, "Progressionen", "Progressions", "Progresiones", "/ee/ZPK/BG/2012/02/19/"],
  ["BG", "II", 20, "Statik und Dynamik", "Statics and Dynamics", "Estática y dinámica", "/ee/ZPK/BG/2012/02/20/"],
  ["BG", "II", 21, "Mechanik", "Mechanics", "Mecánica", "/ee/ZPK/BG/2012/02/21/"],
  ["BG", "II", 22, "Deutungen", "Interpretations", "Interpretaciones", "/ee/ZPK/BG/2012/02/22/"],
  ["BG", "II", 23, "Übungssammlung", "Collection of Exercises", "Colección de ejercicios", "/ee/ZPK/BG/2012/02/23/"],
  ["BG", "III", 24, "Stereometrische Gestaltung", "Stereometric Design", "Configuración estereométrica", "/ee/ZPK/BG/2012/03/24/"],
  ["BG", "Anhang", 0, "Anhang", "Appendix", "Apéndice", "/ee/ZPK/BG/2012/04/01/"],
];

// Estimated total page counts from the foundational doc (for the
// "archive coverage" display). 0 = unknown.
const PAGE_ESTIMATES = {
  BF: 195,
  "BG-I-1": 10,
  "BG-I-2": 5,
  "BG-I-3": 10,
  "BG-I-4": 13,
};

// ── helpers ─────────────────────────────────────────────────────
const slug = (s) =>
  s.toLowerCase().replace(/[.\s/]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");

const localImg = (p) => "/" + p.replace(/^images\//, "manuscripts/").replace(/\\/g, "/");

function chapterId(section, part, num) {
  return slug(`${section}-${part ?? ""}-${num}`);
}

// ── copy images ─────────────────────────────────────────────────
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) count += copyDir(s, d);
    else {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

// ── build ───────────────────────────────────────────────────────
function build() {
  if (!fs.existsSync(ENRICHED)) {
    console.error(`Source not found: ${ENRICHED}`);
    process.exit(1);
  }

  // Copy images
  const srcImg = path.join(SRC, "images");
  if (fs.existsSync(srcImg)) {
    fs.rmSync(PUBLIC_IMG, { recursive: true, force: true });
    const n = copyDir(srcImg, PUBLIC_IMG);
    console.log(`Copied ${n} manuscript images → public/manuscripts`);
  }

  // Chapters
  const chapters = CHAPTERS.map(([section, part, num, de, en, es, url]) => {
    const id = chapterId(section, part, num);
    return {
      id,
      section,
      part,
      chapter_number: num,
      name_de: de,
      name_en: en,
      name_es: es,
      url_path: url,
      total_pages: PAGE_ESTIMATES[id] ?? 0,
      extracted: false,
    };
  });

  // Pages + articles
  const pageFiles = fs
    .readdirSync(ENRICHED)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const pages = [];
  const articles = [];

  for (const file of pageFiles) {
    const raw = JSON.parse(fs.readFileSync(path.join(ENRICHED, file), "utf-8"));
    const { section, part, chapter_number, page_number, page_ref } = raw;
    const pad = String(page_number).padStart(3, "0");
    const facsimile = `/manuscripts/${section}/${part}/${String(chapter_number).padStart(2, "0")}/${pad}/page.jpg`;
    const facsimileExists = fs.existsSync(path.join(PROJECT, "public", facsimile.replace(/^\//, "")));

    const pageId = slug(page_ref);
    const pageArticles = [];

    for (const a of raw.articles) {
      const key = `${page_number}-${a.article_number}`;
      const tr = T[key];
      const text_en = tr ? tr.en : a.text_de;
      const text_es = tr ? tr.es : a.text_de;

      const article = {
        id: `${pageId}-a${a.article_number}`,
        page_ref,
        section,
        part,
        chapter_number,
        page_number,
        article_number: a.article_number,
        ref: `${page_ref} art.${a.article_number}`,

        text_de: a.text_de || "",
        paragraphs_de: a.paragraphs_de || [],
        footnotes_de: a.footnotes_de || [],

        text_en,
        text_es,
        paragraphs_en: tr ? [tr.en] : a.paragraphs_de || [],
        paragraphs_es: tr ? [tr.es] : a.paragraphs_de || [],

        translation_status: tr ? "human_reviewed" : a.translation_status || "empty",

        images: (a.images || []).map((img) => ({
          url_remote: img.url_remote,
          url_large: img.url_large,
          url_local: localImg(img.url_local),
        })),
        pdf_url: a.pdf_url || "",

        metadata: {
          concepts_de: a.metadata?.concepts_de || [],
          concepts_en: a.metadata?.concepts_en || [],
          concepts_es: a.metadata?.concepts_es || [],
          themes: a.metadata?.themes || [],
          themes_en: a.metadata?.themes_en || [],
          themes_es: a.metadata?.themes_es || [],
          bauhaus_domain: a.metadata?.bauhaus_domain || "general",
          content_type: a.metadata?.content_type || "theory",
          semantic_tags: a.metadata?.semantic_tags || [],
          complexity_level: a.metadata?.complexity_level || "introductory",
          has_diagrams: !!a.metadata?.has_diagrams,
          has_mathematical_notation: !!a.metadata?.has_mathematical_notation,
          teaching_context: a.metadata?.teaching_context || "lecture",
        },
        search_index: {
          all_words_de: a.search_index?.all_words_de || [],
          word_count_de: a.search_index?.word_count_de || 0,
          unique_words_de: a.search_index?.unique_words_de || 0,
          word_frequencies_de: a.search_index?.word_frequencies_de || {},
        },
      };
      pageArticles.push(article);
      articles.push(article);
    }

    pages.push({
      id: pageId,
      page_ref,
      section,
      part,
      chapter_number,
      chapter_name_de: raw.chapter_name_de,
      page_number,
      url: raw.url,
      facsimile_local: facsimileExists ? facsimile : "",
      articles: pageArticles,
      total_articles: pageArticles.length,
    });
  }

  // Mark extracted chapters
  const extractedSet = new Set(pages.map((p) => chapterId(p.section, p.part, p.chapter_number)));
  for (const c of chapters) {
    if (extractedSet.has(c.id)) {
      c.extracted = true;
      c.total_pages = pages.filter((p) => chapterId(p.section, p.part, p.chapter_number) === c.id).length;
    }
  }

  // Glossary (fill EN/ES for discovered terms)
  const glossaryRaw = JSON.parse(fs.readFileSync(path.join(SRC, "data", "glossary.json"), "utf-8"));
  const glossary = glossaryRaw.glossary.map((g) => {
    let { term_en, term_es } = g;
    if ((!term_en || !term_es) && TERM_DICT[g.term_de]) {
      const [en, es] = TERM_DICT[g.term_de];
      term_en = term_en || en;
      term_es = term_es || es;
    }
    return { ...g, term_en, term_es };
  });

  const stats = JSON.parse(fs.readFileSync(path.join(SRC, "data", "corpus_stats.json"), "utf-8"));

  const seed = {
    chapters,
    pages,
    articles,
    glossary,
    stats,
    meta: {
      project: "Alexandria-Klee",
      source: "Zentrum Paul Klee — kleegestaltungslehre.zpk.org (BG I.2 Principielle Ordnung)",
      generated_at: "2026-05-30",
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(seed, null, 2), "utf-8");
  console.log(
    `Wrote seed.json — ${chapters.length} chapters, ${pages.length} pages, ${articles.length} articles, ${glossary.length} glossary terms.`
  );
}

build();
