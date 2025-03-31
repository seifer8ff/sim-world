import { extensions as et, ExtensionType as it, SCALE_MODES as ut, Texture as O, groupD8 as x, DRAW_MODES as dt, Resource as mt, ALPHA_MODES as pt, Shader as vt, Program as Tt, Matrix as Et, Geometry as gt, Buffer as st, ObjectRenderer as bt, utils as xt, BaseTexture as At, WRAP_MODES as It } from "@pixi/core";
import { Container as nt, Bounds as Mt } from "@pixi/display";
class C {
  /** @param renderer */
  constructor(t) {
    this.tileAnim = [0, 0], this.dontUseTransform = !1, this.renderer = t, this.tileAnim = [0, 0];
  }
  static registerExtension() {
    et.add({
      name: "tilemap",
      type: it.CanvasRendererPlugin,
      ref: C
    });
  }
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  static getInstance(t) {
    if (!t.plugins.tilemap)
      throw new Error("Extension not registered!");
    return t.plugins.tilemap;
  }
}
const p = {
  /** The default number of textures per tilemap in a tilemap composite. */
  TEXTURES_PER_TILEMAP: 16,
  /**
   * The width/height of each texture tile in a {@link TEXTILE_DIMEN}. This is 1024px by default.
   *
   * This should fit all tile base-textures; otherwise, {@link TextileResource} may fail to correctly
   * upload the textures together in a tiled fashion.
   */
  TEXTILE_DIMEN: 1024,
  /**
   * The number of texture tiles per {@link TextileResource}.
   *
   * Texture tiling is disabled by default, and so this is set to `1` by default. If it is set to a
   * higher value, textures will be uploaded together in a tiled fashion.
   *
   * Since {@link TextileResource} is a dual-column format, this should be even for packing
   * efficiency. The optimal value is usually 4.
   */
  TEXTILE_UNITS: 1,
  /** The scaling mode of the combined texture tiling. */
  TEXTILE_SCALE_MODE: ut.LINEAR,
  /** This will enable 32-bit index buffers. It's useful when you have more than 16K tiles. */
  use32bitIndex: !1,
  /** Flags whether textiles should be cleared when each tile is uploaded. */
  DO_CLEAR: !0,
  // Backward compatibility
  get maxTextures() {
    return this.MAX_TEXTURES;
  },
  set maxTextures(i) {
    this.MAX_TEXTURES = i;
  },
  get boundSize() {
    return this.TEXTURE_TILE_DIMEN;
  },
  set boundSize(i) {
    this.TILE_TEXTURE_DIMEN = i;
  },
  get boundCountPerBuffer() {
    return this.TEXTILE_UNITS;
  },
  set boundCountPerBuffer(i) {
    this.TEXTILE_UNITS = i;
  }
}, yt = p;
var rt = /* @__PURE__ */ ((i) => (i[i.U = 0] = "U", i[i.V = 1] = "V", i[i.X = 2] = "X", i[i.Y = 3] = "Y", i[i.TILE_WIDTH = 4] = "TILE_WIDTH", i[i.TILE_HEIGHT = 5] = "TILE_HEIGHT", i[i.ROTATE = 6] = "ROTATE", i[i.ANIM_X = 7] = "ANIM_X", i[i.ANIM_Y = 8] = "ANIM_Y", i[i.TEXTURE_INDEX = 9] = "TEXTURE_INDEX", i[i.ANIM_COUNT_X = 10] = "ANIM_COUNT_X", i[i.ANIM_COUNT_Y = 11] = "ANIM_COUNT_Y", i[i.ANIM_DIVISOR = 12] = "ANIM_DIVISOR", i[i.ALPHA = 13] = "ALPHA", i[i.TINT_R = 14] = "TINT_R", i[i.TINT_G = 15] = "TINT_G", i[i.TINT_B = 16] = "TINT_B", i[i.TINT_A = 17] = "TINT_A", i))(rt || {});
const A = Object.keys(rt).length / 2, at = class extends nt {
  // Tracks the current position in pointsBuf
  /**
   * @param tileset - The tileset to use for the tilemap. This can be reset later with {@link Tilemap.setTileset}. The
   *      base-textures in this array must not be duplicated.
   */
  constructor(i) {
    super(), this.shadowColor = new Float32Array([0, 0, 0, 0.5]), this._globalMat = null, this.tileAnim = null, this.modificationMarker = 0, this.offsetX = 0, this.offsetY = 0, this.compositeParent = !1, this.tilemapBounds = new Mt(), this.hasAnimatedTile = !1, this.pointsBufIndex = 0, this.renderCanvas = (t) => {
      const e = C.getInstance(t);
      if (e && !e.dontUseTransform) {
        const s = this.worldTransform;
        t.canvasContext.activeContext.setTransform(
          s.a,
          s.b,
          s.c,
          s.d,
          s.tx * t.resolution,
          s.ty * t.resolution
        );
      }
      this.renderCanvasCore(t);
    }, this.vbId = 0, this.vb = null, this.vbBuffer = null, this.vbArray = null, this.vbInts = null, this.setTileset(i), this.pointsBuf = new Float32Array(at.initialCapacity);
  }
  // Method to dynamically resize the pointsBuf if needed
  ensureCapacity(i) {
    if (this.pointsBuf.length < i) {
      let t = this.pointsBuf.length;
      for (; t < i; )
        t *= 2;
      const e = new Float32Array(t);
      e.set(this.pointsBuf), this.pointsBuf = e;
    }
  }
  /**
   * @returns The tileset of this tilemap.
   */
  getTileset() {
    return this.tileset;
  }
  /**
   * Define the tileset used by the tilemap.
   *
   * @param tileset - The list of textures to use in the tilemap. If a base-texture (not array) is passed, it will
   *  be wrapped into an array. This should not contain any duplicates.
   */
  setTileset(i = []) {
    Array.isArray(i) || (i = [i]);
    for (let t = 0; t < i.length; t++)
      i[t].baseTexture && (i[t] = i[t].baseTexture);
    return this.tileset = i, this;
  }
  /**  Clears all the tiles added into this tilemap. */
  clear() {
    return this.pointsBufIndex = 0, this.pointsBuf.fill(0), this.modificationMarker = 0, this.tilemapBounds.clear(), this.hasAnimatedTile = !1, this;
  }
  /**
   * Adds a tile that paints the given texture at (x, y).
   *
   * @param tileTexture - The tiling texture to render.
   * @param x - The local x-coordinate of the tile's position.
   * @param y - The local y-coordinate of the tile's position.
   * @param options - Additional tile options.
   * @param [options.u=texture.frame.x] - The x-coordinate of the texture in its base-texture's space.
   * @param [options.v=texture.frame.y] - The y-coordinate of the texture in its base-texture's space.
   * @param [options.tileWidth=texture.orig.width] - The local width of the tile.
   * @param [options.tileHeight=texture.orig.height] - The local height of the tile.
   * @param [options.animX=0] - For animated tiles, this is the "offset" along the x-axis for adjacent
   *      animation frame textures in the base-texture.
   * @param [options.animY=0] - For animated tiles, this is the "offset" along the y-axis for adjacent
   *      animation frames textures in the base-texture.
   * @param [options.rotate=0]
   * @param [options.animCountX=1024] - For animated tiles, this is the number of animation frame textures
   *      per row.
   * @param [options.animCountY=1024] - For animated tiles, this is the number of animation frame textures
   *      per column.
   * @param [options.animDivisor=1] - For animated tiles, this is the animation duration of each frame
   * @param [options.alpha=1] - Tile alpha
   * * @param [options.alpha=[255, 255, 255, 1]] - Tile tint [r,g,b,a]
   * @return This tilemap, good for chaining.
   */
  tile(i, t, e, s = {}) {
    let o, a = -1;
    if (typeof i == "number")
      a = i, o = this.tileset[a];
    else {
      let m;
      typeof i == "string" ? m = O.from(i) : m = i;
      const g = this.tileset;
      for (let v = 0; v < g.length; v++)
        if (g[v] === m.castToBaseTexture()) {
          a = v;
          break;
        }
      "baseTexture" in m && (s.u = s.u ?? m.frame.x, s.v = s.v ?? m.frame.y, s.tileWidth = s.tileWidth ?? m.orig.width, s.tileHeight = s.tileHeight ?? m.orig.height), o = m.castToBaseTexture();
    }
    if (!o || a < 0)
      return console.error(
        "The tile texture was not found in the tilemap tileset."
      ), this;
    const {
      u: h = 0,
      v: c = 0,
      tileWidth: l = o.realWidth,
      tileHeight: f = o.realHeight,
      animX: d = 0,
      animY: n = 0,
      rotate: r = 0,
      animCountX: E = 1024,
      animCountY: M = 1024,
      animDivisor: y = 1,
      alpha: u = 1,
      tint: B = [255, 255, 255, 1]
    } = s, X = this.pointsBuf, L = this.pointsBufIndex;
    this.hasAnimatedTile = this.hasAnimatedTile || d > 0 || n > 0, this.ensureCapacity(L + A);
    const b = [
      h,
      c,
      t,
      e,
      l,
      f,
      r,
      d | 0,
      n | 0,
      a,
      E,
      M,
      y,
      u,
      B[0],
      B[1],
      B[2],
      B[3]
    ];
    for (let m = 0; m < b.length; m++)
      X[L + m] = b[m];
    return this.pointsBufIndex += A, this.tilemapBounds.addFramePad(
      t,
      e,
      t + o.realWidth,
      e + o.realHeight,
      0,
      0
    ), this;
  }
  /** Changes the rotation of the last tile. */
  tileRotate(i) {
    const t = this.pointsBuf;
    t[t.length - (A - 9)] = i;
  }
  /** Changes the `animX`, `animCountX` of the last tile. */
  tileAnimX(i, t) {
    const e = this.pointsBuf;
    e[e.length - (A - 7)] = i, e[e.length - (A - 10)] = t;
  }
  /** Changes the `animY`, `animCountY` of the last tile. */
  tileAnimY(i, t) {
    const e = this.pointsBuf;
    e[e.length - (A - 8)] = i, e[e.length - (A - 11)] = t;
  }
  /** Changes the `animDivisor` value of the last tile. */
  tileAnimDivisor(i) {
    const t = this.pointsBuf;
    t[t.length - (A - 12)] = i;
  }
  tileAlpha(i) {
    const t = this.pointsBuf;
    t[t.length - (A - 13)] = i;
  }
  renderCanvasCore(i) {
    if (this.tileset.length === 0)
      return;
    const t = this.pointsBuf, e = this.tileAnim || i.plugins.tilemap && i.plugins.tilemap.tileAnim;
    i.canvasContext.activeContext.fillStyle = "#000000";
    for (let s = 0, o = t.length; s < o; s += A) {
      let a = t[
        s + 0
        /* U */
      ], h = t[
        s + 1
        /* V */
      ];
      const c = t[
        s + 2
        /* X */
      ], l = t[
        s + 3
        /* Y */
      ], f = t[
        s + 4
        /* TILE_WIDTH */
      ], d = t[
        s + 5
        /* TILE_HEIGHT */
      ];
      a += t[
        s + 7
        /* ANIM_X */
      ] * e[0], h += t[
        s + 8
        /* ANIM_Y */
      ] * e[1];
      const n = t[
        s + 9
        /* TEXTURE_INDEX */
      ], r = t[
        s + 13
        /* ALPHA */
      ], E = t[
        s + 14
        /* TINT_R */
      ] / 255, M = t[
        s + 15
        /* TINT_G */
      ] / 255, y = t[
        s + 16
        /* TINT_B */
      ] / 255, u = t[
        s + 17
        /* TINT_A */
      ];
      i.canvasContext.activeContext.globalAlpha = r * u, i.canvasContext.activeContext.filter = `brightness(${E * 100}%) contrast(${M * 100}%) saturate(${y * 100}%)`, n >= 0 && this.tileset[n] ? (i.canvasContext.activeContext.globalAlpha = r, i.canvasContext.activeContext.drawImage(
        this.tileset[n].getDrawableSource(),
        a,
        h,
        f,
        d,
        c,
        l,
        f,
        d
      )) : (i.canvasContext.activeContext.globalAlpha = 0.5, i.canvasContext.activeContext.fillRect(c, l, f, d)), i.canvasContext.activeContext.globalAlpha = 1;
    }
  }
  destroyVb() {
    this.vb && (this.vb.destroy(), this.vb = null);
  }
  render(i) {
    const t = i.plugins.tilemap, e = t.getShader();
    i.batch.setObjectRenderer(t), this._globalMat = e.uniforms.projTransMatrix, i.globalUniforms.uniforms.projectionMatrix.copyTo(this._globalMat).append(this.worldTransform), e.uniforms.shadowColor = this.shadowColor, e.uniforms.animationFrame = this.tileAnim || t.tileAnim, this.renderWebGLCore(i, t);
  }
  renderWebGLCore(i, t) {
    const e = this.pointsBuf;
    if (e.length === 0)
      return;
    const s = e.length / A, o = t.getShader(), a = this.tileset;
    if (a.length === 0)
      return;
    t.bindTileTextures(i, a), i.shader.bind(o, !1);
    let h = this.vb;
    h || (h = t.createVb(), this.vb = h, this.vbId = h.id, this.vbBuffer = null, this.modificationMarker = 0), t.checkIndexBuffer(s, h);
    const c = p.TEXTILE_UNITS, l = h.getBuffer("aVertexPosition"), f = s * h.vertPerQuad;
    if (f !== 0) {
      if (this.modificationMarker !== f) {
        this.modificationMarker = f;
        const d = h.stride * f;
        if (!this.vbBuffer || this.vbBuffer.byteLength < d) {
          let u = h.stride;
          for (; u < d; )
            u *= 2;
          this.vbBuffer = new ArrayBuffer(u), this.vbArray = new Float32Array(this.vbBuffer), this.vbInts = new Uint32Array(this.vbBuffer), l.update(this.vbBuffer);
        }
        const n = this.vbArray;
        let r = 0, E = 0, M = this.offsetX, y = this.offsetY;
        for (let u = 0; u < e.length; u += A) {
          if (this.compositeParent) {
            const I = e[
              u + 9
              /* TEXTURE_INDEX */
            ];
            c > 1 ? (E = I >> 2, M = this.offsetX * (I & 1), y = this.offsetY * (I >> 1 & 1)) : (E = I, M = 0, y = 0);
          }
          const X = e[
            u + 2
            /* X */
          ], L = e[
            u + 3
            /* Y */
          ], b = e[
            u + 4
            /* TILE_WIDTH */
          ], m = e[
            u + 5
            /* TILE_HEIGHT */
          ], g = e[
            u + 0
            /* U */
          ] + M, v = e[
            u + 1
            /* V */
          ] + y;
          let T = e[
            u + 6
            /* ROTATE */
          ];
          const lt = e[
            u + 7
            /* ANIM_X */
          ], ht = e[
            u + 8
            /* ANIM_Y */
          ], ct = e[
            u + 10
            /* ANIM_COUNT_X */
          ] || 1024, ft = e[
            u + 11
            /* ANIM_COUNT_Y */
          ] || 1024, D = lt + ct * 2048, S = ht + ft * 2048, F = e[
            u + 12
            /* ANIM_DIVISOR */
          ], Y = e[
            u + 13
            /* ALPHA */
          ], N = e[
            u + 14
            /* TINT_R */
          ] / 255, k = e[
            u + 15
            /* TINT_G */
          ] / 255, H = e[
            u + 16
            /* TINT_B */
          ] / 255, R = e[
            u + 17
            /* TINT_A */
          ];
          let V, P, j, z, U, $, Q, K;
          if (T === 0)
            V = g, P = v, j = g + b, z = v, U = g + b, $ = v + m, Q = g, K = v + m;
          else {
            let I = b / 2, _ = m / 2;
            T % 4 !== 0 && (I = m / 2, _ = b / 2);
            const G = g + I, W = v + _;
            T = x.add(T, x.NW), V = G + I * x.uX(T), P = W + _ * x.uY(T), T = x.add(T, 2), j = G + I * x.uX(T), z = W + _ * x.uY(T), T = x.add(T, 2), U = G + I * x.uX(T), $ = W + _ * x.uY(T), T = x.add(T, 2), Q = G + I * x.uX(T), K = W + _ * x.uY(T);
          }
          n[r++] = X, n[r++] = L, n[r++] = V, n[r++] = P, n[r++] = g + 0.5, n[r++] = v + 0.5, n[r++] = g + b - 0.5, n[r++] = v + m - 0.5, n[r++] = D, n[r++] = S, n[r++] = E, n[r++] = F, n[r++] = Y, n[r++] = N, n[r++] = k, n[r++] = H, n[r++] = R, n[r++] = X + b, n[r++] = L, n[r++] = j, n[r++] = z, n[r++] = g + 0.5, n[r++] = v + 0.5, n[r++] = g + b - 0.5, n[r++] = v + m - 0.5, n[r++] = D, n[r++] = S, n[r++] = E, n[r++] = F, n[r++] = Y, n[r++] = N, n[r++] = k, n[r++] = H, n[r++] = R, n[r++] = X + b, n[r++] = L + m, n[r++] = U, n[r++] = $, n[r++] = g + 0.5, n[r++] = v + 0.5, n[r++] = g + b - 0.5, n[r++] = v + m - 0.5, n[r++] = D, n[r++] = S, n[r++] = E, n[r++] = F, n[r++] = Y, n[r++] = N, n[r++] = k, n[r++] = H, n[r++] = R, n[r++] = X, n[r++] = L + m, n[r++] = Q, n[r++] = K, n[r++] = g + 0.5, n[r++] = v + 0.5, n[r++] = g + b - 0.5, n[r++] = v + m - 0.5, n[r++] = D, n[r++] = S, n[r++] = E, n[r++] = F, n[r++] = Y, n[r++] = N, n[r++] = k, n[r++] = H, n[r++] = R;
        }
        l.update(n);
      }
      i.geometry.bind(h, o), i.geometry.draw(dt.TRIANGLES, s * 6, 0);
    }
  }
  /**
   * @internal
   * @ignore
   */
  isModified(i) {
    return !!(this.modificationMarker !== this.pointsBuf.length || i && this.hasAnimatedTile);
  }
  /**
   * This will pull forward the modification marker.
   *
   * @internal
   * @ignore
   */
  clearModify() {
    this.modificationMarker = this.pointsBuf.length;
  }
  /** @override */
  _calculateBounds() {
    const { minX: i, minY: t, maxX: e, maxY: s } = this.tilemapBounds;
    this._bounds.addFrame(this.transform, i, t, e, s);
  }
  /** @override */
  getLocalBounds(i) {
    return this.children.length === 0 ? this.tilemapBounds.getRectangle(i) : super.getLocalBounds.call(this, i);
  }
  /** @override */
  destroy(i) {
    super.destroy(i), this.destroyVb();
  }
  /**
   * Deprecated signature for {@link Tilemap.tile tile}.
   *
   * @deprecated Since @pixi/tilemap 3.
   */
  addFrame(i, t, e, s, o) {
    return this.tile(i, t, e, {
      animX: s,
      animY: o
    }), !0;
  }
  /**
   * Deprecated signature for {@link Tilemap.tile tile}.
   *
   * @deprecated Since @pixi/tilemap 3.
   */
  // eslint-disable-next-line max-params
  addRect(i, t, e, s, o, a, h, c = 0, l = 0, f = 0, d = 1024, n = 1024, r = 1, E = 1) {
    return this.tile(i, s, o, {
      u: t,
      v: e,
      tileWidth: a,
      tileHeight: h,
      animX: c,
      animY: l,
      rotate: f,
      animCountX: d,
      animCountY: n,
      animDivisor: r,
      alpha: E
    });
  }
};
let w = at;
w.initialCapacity = 1e4 * A;
class tt extends nt {
  /**
   * @param tileset - A list of tile base-textures that will be used to eagerly initialized the layered
   *  tilemaps. This is only an performance optimization, and using {@link CompositeTilemap.tile tile}
   *  will work equivalently.
   */
  constructor(t) {
    super(), this.tileAnim = null, this.lastModifiedTilemap = null, this.modificationMarker = 0, this.shadowColor = new Float32Array([0, 0, 0, 0.5]), this._globalMat = null, this.setBitmaps = this.tileset, this.tileset(t), this.texturesPerTilemap = p.TEXTURES_PER_TILEMAP;
  }
  /**
   * This will preinitialize the tilesets of the layered tilemaps.
   *
   * If used after a tilemap has been created (or a tile added), this will overwrite the tile textures of the
   * existing tilemaps. Passing the tileset to the constructor instead is the best practice.
   *
   * @param tileTextures - The list of tile textures that make up the tileset.
   */
  tileset(t) {
    t || (t = []);
    const e = this.texturesPerTilemap, s = this.children.length, o = Math.ceil(t.length / e);
    for (let a = 0; a < Math.min(s, o); a++)
      this.children[a].setTileset(
        t.slice(a * e, (a + 1) * e)
      );
    for (let a = s; a < o; a++) {
      const h = new w(
        t.slice(a * e, (a + 1) * e)
      );
      h.compositeParent = !0, h.offsetX = p.TEXTILE_DIMEN, h.offsetY = p.TEXTILE_DIMEN, this.addChild(h);
    }
    return this;
  }
  /** Clears the tilemap composite. */
  clear() {
    for (let t = 0; t < this.children.length; t++)
      this.children[t].clear();
    return this.modificationMarker = 0, this;
  }
  /** Changes the rotation of the last added tile. */
  tileRotate(t) {
    return this.lastModifiedTilemap && this.lastModifiedTilemap.tileRotate(t), this;
  }
  /** Changes `animX`, `animCountX` of the last added tile. */
  tileAnimX(t, e) {
    return this.lastModifiedTilemap && this.lastModifiedTilemap.tileAnimX(t, e), this;
  }
  /** Changes `animY`, `animCountY` of the last added tile. */
  tileAnimY(t, e) {
    return this.lastModifiedTilemap && this.lastModifiedTilemap.tileAnimY(t, e), this;
  }
  /** Changes `tileAnimDivisor` value of the last added tile. */
  tileAnimDivisor(t) {
    return this.lastModifiedTilemap && this.lastModifiedTilemap.tileAnimDivisor(t), this;
  }
  /**
   * Adds a tile that paints the given tile texture at (x, y).
   *
   * @param tileTexture - The tile texture. You can pass an index into the composite tilemap as well.
   * @param x - The local x-coordinate of the tile's location.
   * @param y - The local y-coordinate of the tile's location.
   * @param options - Additional options to pass to {@link Tilemap.tile}.
   * @param [options.u=texture.frame.x] - The x-coordinate of the texture in its base-texture's space.
   * @param [options.v=texture.frame.y] - The y-coordinate of the texture in its base-texture's space.
   * @param [options.tileWidth=texture.orig.width] - The local width of the tile.
   * @param [options.tileHeight=texture.orig.height] - The local height of the tile.
   * @param [options.animX=0] - For animated tiles, this is the "offset" along the x-axis for adjacent
   *      animation frame textures in the base-texture.
   * @param [options.animY=0] - For animated tiles, this is the "offset" along the y-axis for adjacent
   *      animation frames textures in the base-texture.
   * @param [options.rotate=0]
   * @param [options.animCountX=1024] - For animated tiles, this is the number of animation frame textures
   *      per row.
   * @param [options.animCountY=1024] - For animated tiles, this is the number of animation frame textures
   *      per column.
   * @param [options.animDivisor=1] - For animated tiles, this is the animation duration each frame
   * @param [options.alpha=1] - Tile alpha
   * @param [options.tint=[255, 255, 255, 1]] - Tile tint [r, g, b, a]
   * @return This tilemap, good for chaining.
   */
  tile(t, e, s, o = {}) {
    let a = null;
    const h = this.children;
    if (this.lastModifiedTilemap = null, typeof t == "number") {
      const c = t / this.texturesPerTilemap >> 0;
      let l = 0;
      if (a = h[c], a)
        l = t % this.texturesPerTilemap;
      else {
        if (a = h[0], !a)
          return this;
        l = 0;
      }
      a.tile(l, e, s, o);
    } else {
      typeof t == "string" && (t = O.from(t));
      for (let c = 0; c < h.length; c++) {
        const l = h[c], f = l.getTileset();
        for (let d = 0; d < f.length; d++)
          if (f[d] === t.baseTexture) {
            a = l;
            break;
          }
        if (a)
          break;
      }
      if (!a) {
        for (let c = h.length - 1; c >= 0; c--) {
          const l = h[c];
          if (l.getTileset().length < this.texturesPerTilemap) {
            a = l, l.getTileset().push(t.baseTexture);
            break;
          }
        }
        a || (a = new w(t.baseTexture), a.compositeParent = !0, a.offsetX = p.TEXTILE_DIMEN, a.offsetY = p.TEXTILE_DIMEN, this.addChild(a));
      }
      a.tile(t, e, s, o);
    }
    return this.lastModifiedTilemap = a, this;
  }
  renderCanvas(t) {
    if (!this.visible || this.worldAlpha <= 0 || !this.renderable)
      return;
    const e = C.getInstance(t);
    if (e && !e.dontUseTransform) {
      const o = this.worldTransform;
      t.canvasContext.activeContext.setTransform(
        o.a,
        o.b,
        o.c,
        o.d,
        o.tx * t.resolution,
        o.ty * t.resolution
      );
    }
    const s = this.children;
    for (let o = 0; o < s.length; o++) {
      const a = s[o];
      a.tileAnim = this.tileAnim, a.renderCanvasCore(t);
    }
  }
  render(t) {
    if (!this.visible || this.worldAlpha <= 0 || !this.renderable)
      return;
    const e = t.plugins.tilemap, s = e.getShader();
    t.batch.setObjectRenderer(e), this._globalMat = s.uniforms.projTransMatrix, t.globalUniforms.uniforms.projectionMatrix.copyTo(this._globalMat).append(this.worldTransform), s.uniforms.shadowColor = this.shadowColor, s.uniforms.animationFrame = this.tileAnim || e.tileAnim, t.shader.bind(s, !1);
    const o = this.children;
    for (let a = 0; a < o.length; a++)
      o[a].renderWebGLCore(t, e);
  }
  /**
   * @internal
   * @ignore
   */
  isModified(t) {
    const e = this.children;
    if (this.modificationMarker !== e.length)
      return !0;
    for (let s = 0; s < e.length; s++)
      if (e[s].isModified(t))
        return !0;
    return !1;
  }
  /**
   * @internal
   * @ignore
   */
  clearModify() {
    const t = this.children;
    this.modificationMarker = t.length;
    for (let e = 0; e < t.length; e++)
      t[e].clearModify();
  }
  /**
   * @deprecated Since @pixi/tilemap 3.
   * @see CompositeTilemap.tile
   */
  addFrame(t, e, s, o, a, h, c, l, f) {
    return this.tile(t, e, s, {
      animX: o,
      animY: a,
      animCountX: h,
      animCountY: c,
      animDivisor: l,
      alpha: f
    });
  }
  /**
   * @deprecated @pixi/tilemap 3
   * @see CompositeTilemap.tile
   */
  // eslint-disable-next-line max-params
  addRect(t, e, s, o, a, h, c, l, f, d, n, r) {
    const E = t / this.texturesPerTilemap >> 0, M = t % this.texturesPerTilemap;
    return this.children[E] && this.children[E].getTileset() ? (this.lastModifiedTilemap = this.children[E], this.lastModifiedTilemap.addRect(
      M,
      e,
      s,
      o,
      a,
      h,
      c,
      l,
      f,
      d,
      n,
      r
    )) : this.lastModifiedTilemap = null, this;
  }
  /**
   * @deprecated Since @pixi/tilemap 3.
   * @readonly
   * @see CompositeTilemap.texturesPerTilemap
   */
  get texPerChild() {
    return this.texturesPerTilemap;
  }
}
class Z extends mt {
  /**
  * @param options - This will default to the "settings" exported by @pixi/tilemap.
  * @param options.TEXTILE_DIMEN - The dimensions of each tile.
  * @param options.TEXTILE_UNITS - The number of texture tiles.
  */
  constructor(t = p) {
    super(
      t.TEXTILE_DIMEN * 2,
      t.TEXTILE_DIMEN * Math.ceil(t.TEXTILE_UNITS / 2)
    ), this.baseTexture = null, this._clearBuffer = null;
    const e = this.tiles = new Array(t.TEXTILE_UNITS);
    this.doClear = !!t.DO_CLEAR, this.tileDimen = t.TEXTILE_DIMEN;
    for (let s = 0; s < t.TEXTILE_UNITS; s++)
      e[s] = {
        dirtyId: 0,
        x: t.TEXTILE_DIMEN * (s & 1),
        y: t.TEXTILE_DIMEN * (s >> 1),
        baseTexture: O.WHITE.baseTexture
      };
  }
  /**
  * Sets the texture to be uploaded for the given tile.
  *
  * @param index - The index of the tile being set.
  * @param texture - The texture with the base-texture to upload.
  */
  tile(t, e) {
    const s = this.tiles[t];
    s.baseTexture !== e && (s.baseTexture = e, this.baseTexture.update(), this.tiles[t].dirtyId = this.baseTexture.dirtyId);
  }
  /** @override */
  bind(t) {
    if (this.baseTexture)
      throw new Error("Only one baseTexture is allowed for this resource!");
    this.baseTexture = t, super.bind(t);
  }
  /** @override */
  upload(t, e, s) {
    const { gl: o } = t, { width: a, height: h } = this;
    o.pixelStorei(
      o.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      e.alphaMode === void 0 || e.alphaMode === pt.UNPACK
    ), s.dirtyId < 0 && (s.width = a, s.height = h, o.texImage2D(
      e.target,
      0,
      e.format,
      a,
      h,
      0,
      e.format,
      e.type,
      null
    ));
    const c = this.doClear, l = this.tiles;
    c && !this._clearBuffer && (this._clearBuffer = new Uint8Array(p.TEXTILE_DIMEN * p.TEXTILE_DIMEN * 4));
    for (let f = 0; f < l.length; f++) {
      const d = l[f], n = d.baseTexture;
      if (s.dirtyId >= this.tiles[f].dirtyId)
        continue;
      const r = n.resource;
      !n.valid || !r || !r.source || (c && (n.width < this.tileDimen || n.height < this.tileDimen) && o.texSubImage2D(
        e.target,
        0,
        d.x,
        d.y,
        this.tileDimen,
        this.tileDimen,
        e.format,
        e.type,
        this._clearBuffer
      ), o.texSubImage2D(
        e.target,
        0,
        d.x,
        d.y,
        e.format,
        e.type,
        r.source
      ));
    }
    return !0;
  }
}
function Lt(i) {
  let t = "";
  t += `
`, t += `
`, t += "if(vTextureId <= -1.0) {", t += `
	color = shadowColor;`, t += `
}`;
  for (let e = 0; e < i; e++)
    t += `
else `, e < i - 1 && (t += `if(textureId == ${e}.0)`), t += `
{`, t += `
	color = texture2D(uSamplers[${e}], textureCoord * uSamplerSize[${e}]);`, t += `
}`;
  return t += `
`, t += `
`, t;
}
function Xt(i, t) {
  const e = [];
  for (let o = 0; o < t; o++)
    e[o] = o;
  i.uniforms.uSamplers = e;
  const s = [];
  for (let o = 0; o < t; o++)
    s.push(1 / 2048), s.push(1 / 2048);
  i.uniforms.uSamplerSize = s;
}
function _t(i, t) {
  return t.replace(/%count%/gi, `${i}`).replace(/%forloop%/gi, Lt(i));
}
const Bt = `#version 100
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec4 aFrame;
attribute vec2 aAnim;
attribute float aAnimDivisor;
attribute float aTextureId;
attribute float aAlpha;
attribute vec4 aTint;

uniform mat3 projTransMatrix;
uniform vec2 animationFrame;

varying vec2 vTextureCoord;
varying float vTextureId;
varying vec4 vFrame;
varying float vAlpha;
varying vec4 vTint;

void main(void)
{
   gl_Position = vec4((projTransMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
   vec2 animCount = floor((aAnim + 0.5) / 2048.0);
   vec2 animFrameOffset = aAnim - animCount * 2048.0;
   vec2 currentFrame = floor(animationFrame / aAnimDivisor);
   vec2 animOffset = animFrameOffset * floor(mod(currentFrame + 0.5, animCount));

   vTextureCoord = aTextureCoord + animOffset;
   vFrame = aFrame + vec4(animOffset, animOffset);
   vTextureId = aTextureId;
   vAlpha = aAlpha;
   vTint = aTint;
}
`, wt = `#version 100
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vTextureCoord;
varying vec4 vFrame;
varying float vTextureId;
varying float vAlpha;
varying vec4 vTint;
uniform vec4 shadowColor;
uniform sampler2D uSamplers[%count%];
uniform vec2 uSamplerSize[%count%];

void main(void)
{
   vec2 textureCoord = clamp(vTextureCoord, vFrame.xy, vFrame.zw);
   float textureId = floor(vTextureId + 0.5);

   vec4 color;
   %forloop%
   gl_FragColor = color * vAlpha * vTint;
}
`;
class J extends vt {
  constructor(t) {
    super(
      new Tt(
        Bt,
        _t(
          t,
          wt
        )
      ),
      {
        animationFrame: new Float32Array(2),
        uSamplers: [],
        uSamplerSize: [],
        projTransMatrix: new Et()
      }
    ), this.maxTextures = 0, this.maxTextures = t, Xt(this, this.maxTextures);
  }
}
class q extends gt {
  constructor() {
    super(), this.vertSize = 17, this.vertPerQuad = 4, this.stride = this.vertSize * 4, this.lastTimeAccess = 0;
    const t = this.buf = new st(new Float32Array(2), !0, !1);
    this.addAttribute("aVertexPosition", t, 0, !1, 0, this.stride, 0).addAttribute("aTextureCoord", t, 0, !1, 0, this.stride, 2 * 4).addAttribute("aFrame", t, 0, !1, 0, this.stride, 4 * 4).addAttribute("aAnim", t, 0, !1, 0, this.stride, 8 * 4).addAttribute("aTextureId", t, 0, !1, 0, this.stride, 10 * 4).addAttribute("aAnimDivisor", t, 0, !1, 0, this.stride, 11 * 4).addAttribute("aAlpha", t, 0, !1, 0, this.stride, 12 * 4).addAttribute("aTint", t, 0, !1, 0, this.stride, 13 * 4);
  }
}
class ot extends bt {
  /** @param renderer - The managing renderer */
  constructor(t) {
    super(t), this.tileAnim = [0, 0], this.ibLen = 0, this.indexBuffer = null, this.textiles = [], this.shader = new J(p.TEXTURES_PER_TILEMAP), this.indexBuffer = new st(void 0, !0, !0), this.checkIndexBuffer(2e3), this.makeTextiles();
  }
  /**
  * Binds the tile textures to the renderer, and updates the tilemap shader's `uSamplerSize` uniform.
  *
  * If {@link settings.TEXTILE_UNITS}
  *
  * @param renderer - The renderer to which the textures are to be bound.
  * @param textures - The tile textures being bound.
  */
  bindTileTextures(t, e) {
    const s = e.length, o = this.shader, a = p.TEXTURES_PER_TILEMAP, h = o.uniforms.uSamplerSize;
    if (!(s > p.TEXTILE_UNITS * a)) {
      if (p.TEXTILE_UNITS <= 1)
        for (let c = 0; c < e.length; c++) {
          const l = e[c];
          if (!l || !l.valid)
            return;
          t.texture.bind(e[c], c), h[c * 2] = 1 / e[c].realWidth, h[c * 2 + 1] = 1 / e[c].realHeight;
        }
      else {
        this.makeTextiles();
        const c = Math.ceil(s / p.TEXTILE_UNITS);
        for (let l = 0; l < s; l++) {
          const f = e[l];
          if (f && f.valid) {
            const d = Math.floor(l / p.TEXTILE_UNITS), n = l % p.TEXTILE_UNITS;
            this.textiles[d].tile(n, f);
          }
        }
        for (let l = 0; l < c; l++)
          t.texture.bind(this.textiles[l].baseTexture, l), h[l * 2] = 1 / this.textiles[l].width, h[l * 2 + 1] = 1 / this.textiles[l].baseTexture.height;
      }
      o.uniforms.uSamplerSize = h;
    }
  }
  start() {
  }
  /**
  * @internal
  * @ignore
  */
  createVb() {
    const t = new q();
    return t.addIndex(this.indexBuffer), t.lastTimeAccess = Date.now(), t;
  }
  /** @return The {@link TilemapShader} shader that this rendering pipeline is using. */
  getShader() {
    return this.shader;
  }
  destroy() {
    super.destroy(), this.shader = null;
  }
  // eslint-disable-next-line no-unused-vars
  checkIndexBuffer(t, e = null) {
    const s = t * 6;
    s <= this.ibLen || (this.ibLen = s, this.indexBuffer.update(xt.createIndicesForQuads(
      t,
      p.use32bitIndex ? new Uint32Array(t * 6) : void 0
    )));
  }
  /** Makes textile resources and initializes {@link TileRenderer.textiles}. */
  makeTextiles() {
    if (!(p.TEXTILE_UNITS <= 1))
      for (let t = 0; t < p.TEXTILE_UNITS; t++) {
        if (this.textiles[t])
          continue;
        const e = new Z(), s = new At(e);
        s.scaleMode = p.TEXTILE_SCALE_MODE, s.wrapMode = It.CLAMP, this.textiles[t] = e;
      }
  }
}
const St = {
  CanvasTileRenderer: C,
  CompositeRectTileLayer: tt,
  CompositeTilemap: tt,
  Constant: yt,
  TextileResource: Z,
  MultiTextureResource: Z,
  RectTileLayer: w,
  Tilemap: w,
  TilemapShader: J,
  TilemapGeometry: q,
  RectTileShader: J,
  RectTileGeom: q,
  TileRenderer: ot
};
et.add({
  name: "tilemap",
  type: it.RendererPlugin,
  ref: ot
});
export {
  C as CanvasTileRenderer,
  tt as CompositeRectTileLayer,
  tt as CompositeTilemap,
  yt as Constant,
  A as POINT_STRUCT_SIZE,
  w as RectTileLayer,
  Z as TextileResource,
  ot as TileRenderer,
  w as Tilemap,
  q as TilemapGeometry,
  J as TilemapShader,
  Xt as fillSamplers,
  _t as generateFragmentSrc,
  St as pixi_tilemap,
  p as settings
};
//# sourceMappingURL=pixi-tilemap.es.js.map
