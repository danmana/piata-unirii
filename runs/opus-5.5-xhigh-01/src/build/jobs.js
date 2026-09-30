// Generation job dispatcher (runs inside workers, or on the main thread as a fallback).

import { meshLods } from '../core/mesher.js';
import { buildChurchBody, buildChurchTower } from './church.js';
import { buildMonument } from './monument.js';
import { buildFacade } from './facade.js';
import { buildBanffy, buildMirror, buildContinental } from './heroes.js';
import { buildCityHouse, buildBlock } from './city.js';
import { buildGroundTile, buildTerrainTile } from './ground.js';
import { buildTree, buildProp, buildVehicle, buildArchaeo } from './templates.js';

export function runJob(job) {
  const t0 = performance.now();
  let res;
  switch (job.type) {
    case 'ground': res = { lods: [{ geo: buildGroundTile(job).geo, inst: [] }] }; break;
    case 'terrain': res = { lods: [{ geo: buildTerrainTile(job).geo, inst: [] }] }; break;
    default: {
      const built = build(job);
      const lods = meshLods(built.grid, built.mats, job.local ? null : job.xf, job.lods ?? 3, { detail: job.detail ?? !job.local });
      res = { lods, meta: { height: built.height, radius: built.radius, length: built.length } };
    }
  }
  res.ms = performance.now() - t0;
  return res;
}

function build(job) {
  switch (job.type) {
    case 'church-body': return buildChurchBody();
    case 'church-tower': return buildChurchTower();
    case 'monument': return buildMonument();
    case 'banffy': return buildBanffy(job.spec);
    case 'mirror': return buildMirror(job.spec);
    case 'continental': return buildContinental(job.spec);
    case 'facade': return buildFacade(job.spec);
    case 'city': return buildCityHouse(job.spec);
    case 'block': return buildBlock(job.spec);
    case 'archaeo': return buildArchaeo(job.spec);
    case 'tree': return buildTree(job.species, job.seed);
    case 'prop': return buildProp(job.kind);
    case 'vehicle': return buildVehicle(job.kind);
    default: throw new Error('Unknown job type ' + job.type);
  }
}
