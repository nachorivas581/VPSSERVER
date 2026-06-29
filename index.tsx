
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator, TextInput, StatusBar,
  Dimensions, PanResponder, FlatList, TouchableOpacity, ScrollView,
  Animated, Easing, Image, Platform, UIManager, LayoutAnimation,
  RefreshControl, Modal, Alert, SafeAreaView,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getWindow = () => Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════
   CONFIGURACIÓN
═══════════════════════════════════════════════════════════ */
const TMDB_API_KEY           = 'cd567a4b1c99d7e5acebd57afda5a196';
const GOOGLE_DRIVE_API_KEY   = 'AIzaSyAsQYU7JBhGalFd8woneHClsm5FJdOTHF4';
const DRIVE_FOLDER_PELICULAS = '10G68TcC3ywAUfyXz82QntyCRwb-2yKq2';
const DRIVE_FOLDER_SERIES    = '1J4v2HMFaKy2ZKg20QU7kmH7k7rRV13Zh';
const M3U_URL                = 'https://naphdev.online/list.m3u';

const ACCENT_COLORS: Record<string, string> = {
  red:    '#E50914',
  violet: '#7C3AED',
  blue:   '#3B82F6',
  green:  '#10B981',
  gold:   '#F59E0B',
};

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════ */
const T = {
  color: {
    bg:              '#08080F',
    surface:         '#0F0F1A',
    surfaceElevated: '#161625',
    surfaceHigh:     '#1E1E30',
    border:          'rgba(255,255,255,0.06)',
    borderActive:    'rgba(255,255,255,0.16)',
    textPrimary:     '#F0F0FF',
    textSecondary:   'rgba(240,240,255,0.55)',
    textMuted:       'rgba(240,240,255,0.28)',
    gold:            '#F59E0B',
    success:         '#10D07A',
    live:            '#FF2D55',
    overlay:         'rgba(8,8,15,0.85)',
    overlayLight:    'rgba(8,8,15,0.55)',
  },
  font: {
    xs: 10, sm: 12, base: 14, md: 16, lg: 19, xl: 23, xxl: 28, hero: 36,
    regular: '400' as const, medium: '500' as const, semibold: '600' as const,
    bold: '700' as const, extrabold: '800' as const, black: '900' as const,
  },
  space: { xs: 3, sm: 7, md: 13, lg: 18, xl: 26, xxl: 38 },
  radius: { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, full: 999 },
};

/* ═══════════════════════════════════════════════════════════
   ESCALA Y DISPOSITIVO
═══════════════════════════════════════════════════════════ */
const { width: W, height: H } = getWindow();
const IS_TV     = Platform.isTV || W >= 960;
const IS_TABLET = !IS_TV && W >= 600;
const IS_SMALL  = !IS_TV && !IS_TABLET && W <= 390;
const SCALE     = IS_TV ? 1.6 : IS_TABLET ? 1.25 : IS_SMALL ? 0.9 : 1;
const s         = (n: number) => Math.round(n * SCALE);

const LIVE_PLAYER_H = IS_TV ? Math.round(W * 0.38) : IS_TABLET ? 260 : IS_SMALL ? 170 : 205;
const VOD_PLAYER_H  = IS_TV ? Math.round(W * 0.38) : IS_TABLET ? 260 : IS_SMALL ? 185 : 220;
const MEDIA_COLS    = IS_TV ? 5 : IS_TABLET ? 4 : 3;

/* ═══════════════════════════════════════════════════════════
   TIPOS
═══════════════════════════════════════════════════════════ */
interface Canal {
  id: string; numero: number; name: string; url: string;
  logo: string; category: string; nowPlaying?: string; needsWebView?: boolean;
}
interface MediaItem {
  id: string; title: string; poster: string; backdrop?: string;
  genre?: string; year?: number; rating?: string; seasons?: number;
  overview?: string; type?: 'movie' | 'tv'; custom?: boolean;
  streamUrl?: string; seasonFolderId?: string; episodes?: EpisodeItem[];
}
interface EpisodeItem {
  id: string; name: string; streamUrl: string; season: number; episode: number;
}
interface QualityLevel { label: string; height: number; index: number; }

/* ═══════════════════════════════════════════════════════════
   CANALES MANUALES
═══════════════════════════════════════════════════════════ */
const CANALES_MANUALES: Canal[] = [
  { id: 'man-1',  numero: 1,  name: 'DSports',        url: 'https://streamtpday1.xyz/global1.php?stream=dsports',      logo: 'https://upload.wikimedia.org/wikipedia/commons/d/df/DirecTV_Sports_logo.png', category: 'Deportes',        nowPlaying: 'Fútbol: Copa Libertadores' },
  { id: 'man-2',  numero: 2,  name: 'DSports 2',      url: 'https://streamtpday1.xyz/global1.php?stream=dsports2',     logo: '', category: 'Deportes',        nowPlaying: 'Tenis: Wimbledon' },
  { id: 'man-3',  numero: 3,  name: 'DSports +',      url: 'https://streamtpday1.xyz/global1.php?stream=dsportsplus',  logo: '', category: 'Deportes',        nowPlaying: 'Motociclismo: MotoGP' },
  { id: 'man-4',  numero: 4,  name: 'TyC Sports',     url: 'https://streamtpday1.xyz/global1.php?stream=tyc',          logo: '', category: 'Deportes',        nowPlaying: 'Noticias Deportivas' },
  { id: 'man-5',  numero: 5,  name: 'TNT Sports',     url: 'https://streamtpday1.xyz/global1.php?stream=tntsports',    logo: '', category: 'Deportes',        nowPlaying: 'Fútbol Argentino' },
  { id: 'man-6',  numero: 6,  name: 'ESPN Premium',   url: 'https://streamtpday1.xyz/global1.php?stream=espnpremium',  logo: '', category: 'Deportes',        nowPlaying: 'Fútbol Europeo' },
  { id: 'man-7',  numero: 7,  name: 'ESPN 1',         url: 'https://streamtpday1.xyz/global1.php?stream=espn',         logo: '', category: 'Deportes',        nowPlaying: 'Baloncesto NBA' },
  { id: 'man-8',  numero: 8,  name: 'ESPN 2',         url: 'https://streamtpday1.xyz/global1.php?stream=espn2',        logo: '', category: 'Deportes',        nowPlaying: 'Béisbol MLB' },
  { id: 'man-9',  numero: 9,  name: 'ESPN 3',         url: 'https://streamtpday1.xyz/global1.php?stream=espn3',        logo: '', category: 'Deportes',        nowPlaying: 'Análisis Deportivo' },
  { id: 'man-10', numero: 10, name: 'ESPN 4',         url: 'https://streamtpday1.xyz/global1.php?stream=espn4',        logo: '', category: 'Deportes',        nowPlaying: 'Rugby' },
  { id: 'man-11', numero: 11, name: 'ESPN 5',         url: 'https://streamtpday1.xyz/global1.php?stream=espn5',        logo: '', category: 'Deportes',        nowPlaying: 'Hockey' },
  { id: 'man-12', numero: 12, name: 'Claro Sports',   url: 'https://pluto.tv/latam/live-tv/6320d80a66666000086712d7',  logo: '', category: 'Deportes',        nowPlaying: 'Deportes en Vivo' },
  { id: 'man-13', numero: 13, name: 'TNT Series',     url: 'https://regionales.saohgdasregions.fun/stream.php?canal=tntseries&target=2', logo: '', category: 'Entretenimiento', nowPlaying: 'Series 24/7', needsWebView: true },
  { id: 'man-14', numero: 14, name: 'Disney Channel', url: 'https://regionales.saohgdasregions.fun/stream.php?canal=disney&target=2',    logo: '', category: 'Entretenimiento', nowPlaying: 'Disney 24/7', needsWebView: true },
  { id: 'man-15', numero: 15, name: 'TNT',            url: 'https://regionales.saohgdasregions.fun/stream.php?canal=tnt&target=2',       logo: '', category: 'Entretenimiento', nowPlaying: 'TNT 24/7',    needsWebView: true },
  { id: 'man-16', numero: 16, name: 'Warner Channel', url: 'https://regionales.saohgdasregions.fun/stream.php?canal=warner&target=2',    logo: '', category: 'Entretenimiento', nowPlaying: 'Warner 24/7', needsWebView: true },
  { id: 'man-17', numero: 17, name: 'FX',             url: 'https://regionales.saohgdasregions.fun/stream.php?canal=fx&target=2',        logo: '', category: 'Entretenimiento', nowPlaying: 'FX 24/7',     needsWebView: true },
  { id: 'man-18', numero: 18, name: 'Comedy Central', url: 'https://regionales.saohgdasregions.fun/stream.php?canal=comedy&target=2',    logo: '', category: 'Entretenimiento', nowPlaying: 'Comedy 24/7', needsWebView: true },
];

const MOVIES_FALLBACK: MediaItem[] = [
  { id: 'mov1', title: 'Inception',    poster: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', genre: 'Ciencia ficción', year: 2010, rating: '8.8', overview: 'Un ladrón especializado en el robo de secretos corporativos...', type: 'movie' },
  { id: 'mov2', title: 'Interstellar', poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', genre: 'Ciencia ficción', year: 2014, rating: '8.6', type: 'movie' },
];
const SERIES_FALLBACK: MediaItem[] = [
  { id: 'ser1', title: 'Breaking Bad',    poster: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', genre: 'Drama',          seasons: 5, rating: '9.5', overview: 'Un profesor de química con cáncer terminal...', type: 'tv' },
  { id: 'ser2', title: 'Stranger Things', poster: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', genre: 'Ciencia ficción', seasons: 4, rating: '8.7', type: 'tv' },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function esUrlManifiesto(v: string) { return /(\.m3u8|\.mpd)(\?|#|$)/i.test(v); }
function extraerManifiesto(txt: string): string | null {
  const m = (txt || '').trim().match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|mpd)(?:\?[^\s"'<>]*)?/i);
  return m ? m[0] : null;
}
function cacheBust(url: string) { return `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`; }
function esCarpertaTemporada(nombre: string): boolean { return /^(season|temporada|temp\.?|s)\s*\d+/i.test(nombre.trim()); }
function parsearEpisodio(nombre: string): { season: number; episode: number } {
  const m = nombre.match(/[Ss](\d{1,2})[Ee](\d{1,2})/);
  if (m) return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
  const m2 = nombre.match(/(\d{1,2})x(\d{1,2})/);
  if (m2) return { season: parseInt(m2[1], 10), episode: parseInt(m2[2], 10) };
  const m3 = nombre.match(/[Ee]p?\.?\s*(\d{1,3})/i);
  if (m3) return { season: 1, episode: parseInt(m3[1], 10) };
  return { season: 1, episode: 0 };
}

/* ── Orientación ── */
async function forzarLandscape() {
  try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch (_) {}
}
async function liberarOrientacion() {
  try { await ScreenOrientation.unlockAsync(); } catch (_) {}
}

/* ═══════════════════════════════════════════════════════════
   GOOGLE DRIVE HELPERS
═══════════════════════════════════════════════════════════ */
function limpiarNombreArchivo(nombre: string): { titulo: string; anio?: number } {
  let n = nombre.replace(/\.(mp4|mkv|avi|mov|webm|m4v)$/i, '');
  const matchAnio = n.match(/\b(19|20)\d{2}\b/);
  const anio = matchAnio ? parseInt(matchAnio[0], 10) : undefined;
  n = n.replace(/[._]/g, ' ').replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(1080p|720p|2160p|4k|hdr|web[-]?dl|bluray|brrip|hdtv|x264|x265|hevc|aac|dual|latino|castellano|subtitulado|temporada|cap(itulo)?s?)\b/gi, ' ')
    .replace(/\bS\d{1,2}(E\d{1,2})?\b/gi, ' ').replace(/\s{2,}/g, ' ').trim();
  return { titulo: n, anio };
}

async function buscarMetadataTMDB(titulo: string, anio: number | undefined, tipo: 'movie' | 'tv'): Promise<any | null> {
  try {
    const ep  = tipo === 'movie' ? 'search/movie' : 'search/tv';
    const yr  = anio ? `&year=${anio}` : '';
    const res = await fetch(`https://api.themoviedb.org/3/${ep}?api_key=${TMDB_API_KEY}&language=es&query=${encodeURIComponent(titulo)}${yr}`);
    const d   = await res.json();
    return d.results?.length ? d.results[0] : null;
  } catch { return null; }
}

async function listarContenidoDrive(folderId: string): Promise<{ carpetas: any[]; archivos: any[] }> {
  let todos: any[] = [], pageToken: string | undefined;
  do {
    const tp  = pageToken ? `&pageToken=${pageToken}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&pageSize=1000&key=${GOOGLE_DRIVE_API_KEY}${tp}`;
    const res = await fetch(url);
    const d   = await res.json();
    if (d.files) todos = todos.concat(d.files);
    pageToken = d.nextPageToken;
  } while (pageToken);
  return {
    carpetas: todos.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
    archivos: todos.filter(f => f.mimeType?.startsWith('video/')),
  };
}

async function listarArchivosDrive(folderId: string): Promise<any[]> {
  const { archivos } = await listarContenidoDrive(folderId);
  return archivos;
}

async function cargarEpisodiosSerie(folderId: string): Promise<EpisodeItem[]> {
  const { carpetas, archivos } = await listarContenidoDrive(folderId);
  const episodios: EpisodeItem[] = [];
  for (const a of archivos) {
    const { season, episode } = parsearEpisodio(a.name);
    episodios.push({
      id: `ep-${a.id}`, name: limpiarNombreArchivo(a.name).titulo || a.name,
      streamUrl: `https://www.googleapis.com/drive/v3/files/${a.id}?alt=media&key=${GOOGLE_DRIVE_API_KEY}`,
      season, episode,
    });
  }
  for (const carpeta of carpetas) {
    if (esCarpertaTemporada(carpeta.name)) {
      const numSeason = parseInt((carpeta.name.match(/\d+/) || ['1'])[0], 10);
      try {
        const eps = await listarArchivosDrive(carpeta.id);
        for (const a of eps) {
          const { episode } = parsearEpisodio(a.name);
          episodios.push({
            id: `ep-${a.id}`, name: limpiarNombreArchivo(a.name).titulo || a.name,
            streamUrl: `https://www.googleapis.com/drive/v3/files/${a.id}?alt=media&key=${GOOGLE_DRIVE_API_KEY}`,
            season: numSeason, episode,
          });
        }
      } catch (e) { console.warn('Error leyendo carpeta temporada:', carpeta.name, e); }
    }
  }
  return episodios.sort((a, b) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);
}

async function construirItemDrive(archivo: any, tipo: 'movie' | 'tv'): Promise<MediaItem> {
  const { titulo, anio } = limpiarNombreArchivo(archivo.name);
  const streamUrl = `https://www.googleapis.com/drive/v3/files/${archivo.id}?alt=media&key=${GOOGLE_DRIVE_API_KEY}`;
  const meta = await buscarMetadataTMDB(titulo, anio, tipo);
  if (meta) {
    return {
      id: `drive-${archivo.id}`,
      title: tipo === 'movie' ? meta.title : meta.name,
      poster: meta.poster_path ? `https://image.tmdb.org/t/p/w500${meta.poster_path}` : 'https://via.placeholder.com/500x750.png?text=Sin+Imagen',
      backdrop: meta.backdrop_path ? `https://image.tmdb.org/t/p/w780${meta.backdrop_path}` : undefined,
      year: tipo === 'movie' ? (meta.release_date ? new Date(meta.release_date).getFullYear() : anio) : (meta.first_air_date ? new Date(meta.first_air_date).getFullYear() : anio),
      rating: meta.vote_average ? meta.vote_average.toFixed(1) : '0.0',
      seasons: tipo === 'tv' ? meta.number_of_seasons : undefined,
      overview: meta.overview || 'Sin descripción disponible.', type: tipo, streamUrl,
    };
  }
  return {
    id: `drive-${archivo.id}`, title: titulo || archivo.name,
    poster: 'https://via.placeholder.com/500x750.png?text=Sin+Imagen',
    year: anio, rating: '0.0', overview: 'Sin descripción disponible.',
    type: tipo, streamUrl, custom: true,
  };
}

async function construirSerieDriveCarpeta(carpeta: any): Promise<MediaItem> {
  const { titulo, anio } = limpiarNombreArchivo(carpeta.name);
  const meta = await buscarMetadataTMDB(titulo, anio, 'tv');
  return {
    id: `drive-serie-${carpeta.id}`,
    title: meta?.name || titulo || carpeta.name,
    poster: meta?.poster_path ? `https://image.tmdb.org/t/p/w500${meta.poster_path}` : 'https://via.placeholder.com/500x750.png?text=Sin+Imagen',
    backdrop: meta?.backdrop_path ? `https://image.tmdb.org/t/p/w780${meta.backdrop_path}` : undefined,
    year: meta?.first_air_date ? new Date(meta.first_air_date).getFullYear() : anio,
    rating: meta?.vote_average ? meta.vote_average.toFixed(1) : '0.0',
    seasons: meta?.number_of_seasons,
    overview: meta?.overview || 'Sin descripción disponible.',
    type: 'tv', custom: true, seasonFolderId: carpeta.id,
  };
}

async function cargarCarpetaDrive(folderId: string, tipo: 'movie' | 'tv', cacheKey: string): Promise<MediaItem[]> {
  try {
    const raw   = await AsyncStorage.getItem(cacheKey);
    const cache = raw ? JSON.parse(raw) : {};
    if (tipo === 'movie') {
      const archivos = await listarArchivosDrive(folderId);
      const items: MediaItem[] = [];
      for (const a of archivos) {
        const ce = cache[a.id];
        if (ce && ce.modifiedTime === a.modifiedTime) items.push(ce.item);
        else { const item = await construirItemDrive(a, tipo); cache[a.id] = { modifiedTime: a.modifiedTime, item }; items.push(item); }
      }
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
      return items;
    } else {
      const { carpetas, archivos } = await listarContenidoDrive(folderId);
      const items: MediaItem[] = [];
      for (const carpeta of carpetas) {
        if (!esCarpertaTemporada(carpeta.name)) {
          const ce = cache[carpeta.id];
          if (ce && ce.modifiedTime === carpeta.modifiedTime) items.push(ce.item);
          else { const item = await construirSerieDriveCarpeta(carpeta); cache[carpeta.id] = { modifiedTime: carpeta.modifiedTime, item }; items.push(item); }
        }
      }
      for (const a of archivos) {
        const ce = cache[a.id];
        if (ce && ce.modifiedTime === a.modifiedTime) items.push(ce.item);
        else { const item = await construirItemDrive(a, tipo); cache[a.id] = { modifiedTime: a.modifiedTime, item }; items.push(item); }
      }
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
      return items;
    }
  } catch (e) { console.warn('Drive error:', e); return []; }
}

/* ═══════════════════════════════════════════════════════════
   INJECT JS WEBVIEW
═══════════════════════════════════════════════════════════ */
const INJECT_BEFORE = `(function(){if(window.__NX__)return;window.__NX__=true;function post(u){try{if(typeof u!=='string'||u.length<12)return;if(!/(\.m3u8|\.mpd)(\\?|#|$)/i.test(u))return;window.ReactNativeWebView.postMessage('FOUND_MANIFEST:'+u);}catch(e){}}try{var oO=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{post(u);}catch(e){}return oO.apply(this,arguments)};}catch(e){}try{var oF=window.fetch;if(oF){window.fetch=function(i,n){try{var u=typeof i==='string'?i:(i&&i.url?i.url:'');post(u);}catch(e){}return oF.apply(this,arguments).then(function(r){try{if(r&&r.url)post(r.url);}catch(e){}return r;});};}}catch(e){}try{var ob=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeName==='VIDEO'){post(n.src||n.currentSrc||'');n.addEventListener('loadedmetadata',function(){post(n.currentSrc||'');});}if(n.nodeName==='SOURCE'){post(n.src||'');}});});});ob.observe(document.documentElement||document.body,{childList:true,subtree:true});}catch(e){}})();true;`;
const INJECT_AFTER = `(function(){function post(u){try{if(typeof u!=='string'||u.length<12)return;if(!/(\.m3u8|\.mpd)(\\?|#|$)/i.test(u))return;window.ReactNativeWebView.postMessage('FOUND_MANIFEST:'+u);}catch(e){}}function scan(){try{var h=document.documentElement.innerHTML||'';var m=h.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi);if(m)m.forEach(post);Array.from(document.getElementsByTagName('video')).forEach(function(v){try{v.play();}catch(e){}post(v.src||v.currentSrc||'');});var b=document.querySelectorAll('.play-button,.vjs-big-play-button,.jw-icon-playback,#play,.play-btn,[data-action="play"]');b.forEach(function(x){try{x.click();}catch(e){}});Array.from(document.getElementsByTagName('source')).forEach(function(s){post(s.getAttribute('src')||'');});}catch(e){}}scan();var iv=setInterval(scan,2000);setTimeout(function(){clearInterval(iv);window.ReactNativeWebView.postMessage('MANIFEST_TIMEOUT');},24000);})();true;`;

/* ═══════════════════════════════════════════════════════════
   SHIMMER
═══════════════════════════════════════════════════════════ */
const Shimmer = ({ w, h, style }: { w: number; h: number; style?: any }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  return (
    <View style={[{ width: w, height: h, backgroundColor: T.color.surface, borderRadius: T.radius.md, overflow: 'hidden' }, style]}>
      <Animated.View style={{ width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.04)', transform: [{ translateX: tx }] }} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   HOOK PERSISTENCIA
═══════════════════════════════════════════════════════════ */
const usePersistedState = <T,>(key: string, init: T) => {
  const [val, setVal] = useState<T>(init);
  useEffect(() => { AsyncStorage.getItem(key).then(s => { if (s) setVal(JSON.parse(s)); }); }, []);
  const update = async (v: T) => { setVal(v); await AsyncStorage.setItem(key, JSON.stringify(v)); };
  return [val, update] as const;
};

/* ═══════════════════════════════════════════════════════════
   REPRODUCTOR NATIVO — LIVE
═══════════════════════════════════════════════════════════ */
const ReproductorNativo = memo(({
  url, contentFit, isLive = false, onError, onStall,
}: { url: string; contentFit: 'contain' | 'fill'; isLive?: boolean; onError?: () => void; onStall?: () => void; }) => {
  const [activeUrl, setActiveUrl] = useState(() => cacheBust(url));
  const player = useVideoPlayer(activeUrl, p => {
    p.loop = false;
    if (isLive) try { (p as any).seekToLiveEdge?.(); } catch (_) {}
    p.play();
  });
  const stallTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPos = useRef(0); const stallCount = useRef(0); const replaceCount = useRef(0);
  const CHECK = 9000, MIN_DELTA = 0.8, STALL_THRESH = 3, MAX_REPLACE = 3;

  useEffect(() => { setActiveUrl(cacheBust(url)); replaceCount.current = 0; stallCount.current = 0; lastPos.current = 0; }, [url]);
  useEffect(() => {
    if (!player) return;
    if (stallTimer.current) clearInterval(stallTimer.current);
    stallTimer.current = setInterval(() => {
      try {
        const pos = player.currentTime ?? 0;
        if (Math.abs(pos - lastPos.current) < MIN_DELTA) {
          stallCount.current++;
          if (stallCount.current >= STALL_THRESH) {
            stallCount.current = 0;
            if (replaceCount.current < MAX_REPLACE) {
              replaceCount.current++;
              try { player.replace(cacheBust(url)); setTimeout(() => { try { if (isLive) (player as any).seekToLiveEdge?.(); player.play(); } catch (_) {} }, 500); }
              catch { try { player.play(); } catch (_) {} }
            } else { if (stallTimer.current) clearInterval(stallTimer.current); onStall?.(); onError?.(); }
          }
        } else { stallCount.current = 0; replaceCount.current = 0; }
        lastPos.current = pos;
      } catch (_) {}
    }, CHECK);
    return () => { if (stallTimer.current) clearInterval(stallTimer.current); };
  }, [player, url]);
  useEffect(() => {
    if (!player) return;
    const s1 = player.addListener('statusChange', (p: any) => {
      if (p?.error) { if (stallTimer.current) clearInterval(stallTimer.current); onError?.(); return; }
      if ((p?.status ?? p) === 'idle') { try { player.replace(cacheBust(url)); setTimeout(() => { try { player.play(); } catch (_) {} }, 400); } catch (_) {} }
    });
    const s2 = player.addListener('playingChange', (p: any) => {
      if (!(p?.isPlaying ?? p)) setTimeout(() => { try { if (!player.playing) player.play(); } catch (_) {} }, 6000);
    });
    return () => { s1.remove(); s2.remove(); };
  }, [player, url, onError]);
  return <VideoView style={StyleSheet.absoluteFill} player={player} contentFit={contentFit} nativeControls={false} />;
});

/* ═══════════════════════════════════════════════════════════
   REPRODUCTOR VOD CON CONTROLES + EPISODIOS INLINE
═══════════════════════════════════════════════════════════ */
const ReproductorVOD = memo(({
  url, contentFit = 'contain', onError, episodios = [], episodioActual, onSelectEpisodio, serieTitle, primaryColor,
}: {
  url: string; contentFit?: 'contain' | 'fill'; onError?: () => void;
  episodios?: EpisodeItem[]; episodioActual?: string; onSelectEpisodio?: (ep: EpisodeItem) => void;
  serieTitle?: string; primaryColor?: string;
}) => {
  const [paused,        setPaused]        = useState(false);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [duration,      setDuration]      = useState(0);
  const [showControls,  setShowControls]  = useState(true);
  const [showEpisodios, setShowEpisodios] = useState(false);
  const [tempActiva,    setTempActiva]    = useState(1);
  const [hasError,      setHasError]      = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accent = primaryColor || T.color.live;

  // FIX: reiniciar reproductor cuando cambia la URL
  const [currentUrl, setCurrentUrl] = useState(url);
  useEffect(() => { setCurrentUrl(url); setPaused(false); setCurrentTime(0); setHasError(false); }, [url]);

  const player = useVideoPlayer(currentUrl, p => { p.loop = false; p.play(); });

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      try {
        setCurrentTime(player.currentTime ?? 0);
        setDuration((player as any).duration ?? 0);
      } catch (_) {}
    }, 500);
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => {
    if (showControls && !showEpisodios) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [showControls, showEpisodios]);

  useEffect(() => {
    if (!player) return;
    const s1 = player.addListener('statusChange', (p: any) => {
      if (p?.error) { setHasError(true); onError?.(); }
    });
    return () => s1.remove();
  }, [player, onError]);

  const togglePlay = () => {
    if (!player) return;
    try {
      if (paused) { player.play(); setPaused(false); }
      else { player.pause(); setPaused(true); }
    } catch (_) {}
    mostrarControles();
  };
  const seek = (delta: number) => {
    if (!player) return;
    try { player.seekBy(delta); setCurrentTime(t => Math.max(0, Math.min(t + delta, duration || 99999))); } catch (_) {}
    mostrarControles();
  };
  const seekTo = (ratio: number) => {
    if (!player || !duration) return;
    try { const t = ratio * duration; player.currentTime = t; setCurrentTime(t); } catch (_) {}
    mostrarControles();
  };
  const mostrarControles = () => { setShowEpisodios(false); setShowControls(true); };

  const fmt = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const s = Math.floor(secs % 60), m = Math.floor(secs / 60) % 60, h = Math.floor(secs / 3600);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const temporadas = [...new Set(episodios.map(e => e.season))].sort((a, b) => a - b);
  const epsFiltrados = episodios.filter(e => e.season === tempActiva);
  const hasEpisodios = episodios.length > 0 && !!onSelectEpisodio;

  if (hasError) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={48} color={accent} />
        <Text style={{ color: '#fff', marginTop: 12, fontSize: T.font.base }}>Error de reproducción</Text>
        <TouchableOpacity style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: accent, borderRadius: T.radius.full }}
          onPress={() => { setHasError(false); setCurrentUrl(url + ''); }}>
          <Text style={{ color: '#fff', fontWeight: T.font.bold }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView style={StyleSheet.absoluteFill} player={player} contentFit={contentFit} nativeControls={false} />

      {/* Tap para controles */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1}
        onPress={() => { if (showEpisodios) setShowEpisodios(false); else mostrarControles(); }} />

      {/* Panel de Episodios */}
      {showEpisodios && hasEpisodios && (
        <View style={vc.episodioPanel}>
          <View style={vc.episodioHeader}>
            <Text style={vc.episodioTitle} numberOfLines={1}>{serieTitle || 'Episodios'}</Text>
            <TouchableOpacity onPress={() => setShowEpisodios(false)}>
              <Ionicons name="close" size={20} color={T.color.textSecondary} />
            </TouchableOpacity>
          </View>
          {temporadas.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}>
                {temporadas.map(t => (
                  <TouchableOpacity key={t} onPress={() => setTempActiva(t)}
                    style={[vc.tempChip, tempActiva === t && { backgroundColor: accent }]}>
                    <Text style={[vc.tempChipTxt, tempActiva === t && { color: '#fff' }]}>T{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          <FlatList
            data={epsFiltrados}
            keyExtractor={ep => ep.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 10 }}
            renderItem={({ item }) => {
              const isActive = item.id === episodioActual;
              return (
                <TouchableOpacity
                  onPress={() => { onSelectEpisodio?.(item); setShowEpisodios(false); }}
                  style={[vc.epItem, isActive && { backgroundColor: accent + '22', borderColor: accent }]}>
                  <View style={[vc.epNumBadge, { backgroundColor: isActive ? accent : T.color.surfaceHigh }]}>
                    <Text style={[vc.epNumTxt, { color: isActive ? '#fff' : T.color.textSecondary }]}>
                      {item.episode > 0 ? String(item.episode).padStart(2, '0') : '?'}
                    </Text>
                  </View>
                  <Text style={[vc.epName, isActive && { color: '#fff' }]} numberOfLines={2}>{item.name}</Text>
                  {isActive && <Ionicons name="play" size={14} color={accent} style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Controles superpuestos */}
      {showControls && !showEpisodios && (
        <View style={vc.overlay}>
          <View style={vc.centerRow}>
            <TouchableOpacity style={vc.ctrlBtn} onPress={() => seek(-10)}>
              <Ionicons name="play-back" size={26} color="#fff" />
              <Text style={vc.ctrlLbl}>10s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={vc.playBtn} onPress={togglePlay}>
              <Ionicons name={paused ? 'play' : 'pause'} size={34} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={vc.ctrlBtn} onPress={() => seek(10)}>
              <Ionicons name="play-forward" size={26} color="#fff" />
              <Text style={vc.ctrlLbl}>10s</Text>
            </TouchableOpacity>
          </View>

          {hasEpisodios && (
            <TouchableOpacity style={vc.episodioToggle}
              onPress={() => { setShowEpisodios(true); if (hideTimer.current) clearTimeout(hideTimer.current); }}>
              <Ionicons name="list" size={17} color="#fff" />
              <Text style={vc.episodioToggleTxt}>Episodios</Text>
            </TouchableOpacity>
          )}

          <View style={vc.progressContainer}>
            <Text style={vc.timeText}>{fmt(currentTime)}</Text>
            <TouchableOpacity style={vc.progressBar} activeOpacity={1}
              onPress={(e) => {
                const totalWidth = getWindow().width - 80;
                seekTo(e.nativeEvent.locationX / totalWidth);
              }}>
              <View style={vc.progressTrack}>
                <View style={[vc.progressFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
                <View style={[vc.progressThumb, { left: `${Math.min(progress * 100, 100)}%`, backgroundColor: accent }]} />
              </View>
            </TouchableOpacity>
            <Text style={vc.timeText}>{fmt(duration)}</Text>
          </View>
        </View>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════
   PANTALLA COMPLETA VOD — LANDSCAPE AUTOMÁTICO
   FIX: ahora el modal espera a que url e item estén listos
═══════════════════════════════════════════════════════════ */
interface FullscreenVODProps {
  url: string;
  item: MediaItem;
  episodios?: EpisodeItem[];
  episodioActual?: string;
  onSelectEpisodio?: (ep: EpisodeItem) => void;
  onClose: () => void;
  primaryColor: string;
}

const FullscreenVOD = memo(({ url, item, episodios = [], episodioActual, onSelectEpisodio, onClose, primaryColor }: FullscreenVODProps) => {
  const [contentFit, setContentFit] = useState<'contain' | 'fill'>('contain');
  // FIX: manejar cambio de episodio desde dentro del reproductor
  const [currentUrl, setCurrentUrl] = useState(url);

  useEffect(() => { setCurrentUrl(url); }, [url]);

  const handleSelectEpisodio = useCallback((ep: EpisodeItem) => {
    setCurrentUrl(ep.streamUrl);
    onSelectEpisodio?.(ep);
  }, [onSelectEpisodio]);

  useEffect(() => {
    forzarLandscape();
    return () => { liberarOrientacion(); };
  }, []);

  return (
    <Modal visible animationType="fade" statusBarTranslucent
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar hidden />
        <ReproductorVOD
          url={currentUrl}
          contentFit={contentFit}
          episodios={episodios}
          episodioActual={episodioActual}
          onSelectEpisodio={handleSelectEpisodio}
          serieTitle={item?.title}
          primaryColor={primaryColor}
        />

        {/* Botonera top */}
        <View style={fs.topBar} pointerEvents="box-none">
          <TouchableOpacity style={fs.topBtn} onPress={onClose}>
            <Ionicons name="chevron-down" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={fs.topTitle} numberOfLines={1}>{item?.title}</Text>
          </View>
          <TouchableOpacity style={fs.topBtn}
            onPress={() => setContentFit(f => f === 'contain' ? 'fill' : 'contain')}>
            <Ionicons name={contentFit === 'contain' ? 'scan-outline' : 'contract-outline'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════
   PANTALLA COMPLETA LIVE
   FIX: muestra WebView en fullscreen cuando el canal la necesita
═══════════════════════════════════════════════════════════ */
interface FullscreenLiveProps {
  url: string | null;
  canal: Canal | null;
  aspect: 'contain' | 'fill';
  onAspectToggle: () => void;
  qualities: QualityLevel[];
  selectedQuality: number;
  onSelectQuality: (idx: number) => void;
  onClose: () => void;
  onPlayerError: () => void;
  onPlayerStall: () => void;
  primaryColor: string;
  // FIX: soporte WebView en fullscreen
  needsWebView?: boolean;
  webViewUri?: string;
  onWebViewMessage?: (e: WebViewMessageEvent) => void;
}

const FullscreenLive = memo(({
  url, canal, aspect, onAspectToggle, qualities, selectedQuality, onSelectQuality,
  onClose, onPlayerError, onPlayerStall, primaryColor,
  needsWebView, webViewUri, onWebViewMessage,
}: FullscreenLiveProps) => {
  const [qualityOpen, setQualityOpen] = useState(false);

  useEffect(() => {
    forzarLandscape();
    return () => { liberarOrientacion(); };
  }, []);

  return (
    <Modal visible animationType="fade" statusBarTranslucent
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar hidden />

        {/* FIX: Si el canal necesita WebView y aún no tenemos URL nativa, mostrar WebView fullscreen */}
        {needsWebView && !url && webViewUri ? (
          <WebView
            source={{ uri: webViewUri }}
            style={StyleSheet.absoluteFill}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mixedContentMode="always"
            injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE}
            injectedJavaScript={INJECT_AFTER}
            onMessage={onWebViewMessage}
          />
        ) : url ? (
          <ReproductorNativo
            url={url}
            contentFit={aspect}
            isLive
            onError={onPlayerError}
            onStall={onPlayerStall}
          />
        ) : (
          <View style={fs.errorBox}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={[fs.errorTxt, { marginTop: 12 }]}>Conectando…</Text>
          </View>
        )}

        {/* Top bar */}
        <View style={fs.topBar} pointerEvents="box-none">
          <TouchableOpacity style={fs.topBtn} onPress={onClose}>
            <Ionicons name="chevron-down" size={24} color="#fff" />
          </TouchableOpacity>
          {canal && (
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={fs.topTitle} numberOfLines={1}>{canal.numero}  {canal.name}</Text>
              {canal.nowPlaying && <Text style={fs.topSub} numberOfLines={1}>{canal.nowPlaying}</Text>}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {qualities.length > 0 && (
              <TouchableOpacity style={fs.topBtn} onPress={() => setQualityOpen(v => !v)}>
                <Ionicons name="layers-outline" size={19} color="#fff" />
                <Text style={fs.qualityLabel}>{selectedQuality < 0 ? 'Auto' : qualities[selectedQuality]?.label}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={fs.topBtn} onPress={onAspectToggle}>
              <Ionicons name={aspect === 'contain' ? 'scan-outline' : 'contract-outline'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quality popup */}
        {qualityOpen && (
          <View style={fs.qualityPopup}>
            <Text style={fs.qualityPopupTitle}>Calidad de video</Text>
            {[{ label: 'Auto (recomendado)', index: -1 }, ...qualities].map(q => (
              <TouchableOpacity key={q.index}
                style={[fs.qualityOption, (selectedQuality === q.index) && { backgroundColor: primaryColor }]}
                onPress={() => { onSelectQuality(q.index); setQualityOpen(false); }}>
                <Text style={fs.qualityOptionTxt}>{q.label}</Text>
                {selectedQuality === q.index && <Ionicons name="checkmark" size={15} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════
   TV EN VIVO SECTION
═══════════════════════════════════════════════════════════ */
const LivePlayerSection = memo(({
  primaryColor, listaCanales, loadingChannels, refreshing, onRefresh, favorites, setFavorites,
}: {
  primaryColor: string; listaCanales: Canal[]; loadingChannels: boolean;
  refreshing: boolean; onRefresh: () => void;
  favorites: string[]; setFavorites: (v: string[]) => void;
}) => {
  const [canal,           setCanal]          = useState<Canal | null>(null);
  const [linkM3u8,        setLinkM3u8]       = useState<string | null>(null);
  const [cazando,         setCazando]        = useState(false);
  const [tntBuscando,     setTntBuscando]    = useState(false);
  const [tntWebView,      setTntWebView]     = useState(false);
  const [fullscreen,      setFullscreen]     = useState(false);
  const [aspect,          setAspect]         = useState<'contain' | 'fill'>('contain');
  const [busqueda,        setBusqueda]       = useState('');
  const [catActiva,       setCatActiva]      = useState('Todos');
  const [categorias,      setCategorias]     = useState<string[]>(['Todos']);
  const [recents,         setRecents]        = useState<Canal[]>([]);
  const [numeroMarcado,   setNumeroMarcado]  = useState('');
  const [errorCanal,      setErrorCanal]     = useState(false);
  const [qualityOpen,     setQualityOpen]    = useState(false);
  const [qualities,       setQualities]      = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);

  const canalRef      = useRef<Canal | null>(null);
  const tntWebViewRef = useRef<WebView>(null);
  const webViewRef    = useRef<WebView>(null);
  const timerCaza     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerZap      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tntRetry      = useRef(0);
  const inputRef      = useRef<TextInput>(null);
  const liveDot       = useRef(new Animated.Value(1)).current;
  const panRef        = useRef<any>(null);

  useEffect(() => { canalRef.current = canal; }, [canal]);
  useEffect(() => {
    const cats = new Set<string>(['Todos']);
    listaCanales.forEach(c => cats.add(c.category));
    if (favorites.length > 0) cats.add('Favoritos');
    setCategorias(Array.from(cats));
    if (!canal && listaCanales.length > 0) sintonizar(listaCanales[0]);
  }, [listaCanales]);
  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(liveDot, { toValue: 0.1, duration: 900, useNativeDriver: true }),
      Animated.timing(liveDot, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ]));
    pulse.start(); return () => pulse.stop();
  }, []);

  const detectarCalidades = useCallback(async (m3u8Url: string) => {
    try {
      const res = await fetch(m3u8Url); const txt = await res.text();
      if (!txt.includes('#EXT-X-STREAM-INF')) { setQualities([]); return; }
      const lines = txt.split('\n'); const niveles: QualityLevel[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          const resMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
          const height = resMatch ? parseInt(resMatch[1], 10) : 0;
          let label = height ? `${height}p` : `Calidad ${niveles.length + 1}`;
          if (height >= 2160) label = '4K'; else if (height >= 1080) label = '1080p HD';
          else if (height >= 720) label = '720p HD'; else if (height >= 480) label = '480p';
          else if (height >= 360) label = '360p'; else if (height > 0) label = `${height}p`;
          niveles.push({ label, height, index: niveles.length });
        }
      }
      setQualities(niveles.length > 1 ? niveles : []);
    } catch { setQualities([]); }
  }, []);

  const obtenerUrlCalidad = useCallback(async (m3u8Url: string, qualityIndex: number): Promise<string> => {
    if (qualityIndex < 0) return m3u8Url;
    try {
      const res = await fetch(m3u8Url); const txt = await res.text();
      const lines = txt.split('\n'); let count = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          if (count === qualityIndex) {
            const next = lines[i + 1]?.trim();
            if (next) { if (next.startsWith('http')) return next; return m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1) + next; }
          }
          count++;
        }
      }
    } catch {}
    return m3u8Url;
  }, []);

  const cambiarCalidad = useCallback(async (qualityIndex: number) => {
    setSelectedQuality(qualityIndex); setQualityOpen(false);
    if (!linkM3u8) return;
    if (qualityIndex < 0) { if (canal) { const url = esUrlManifiesto(canal.url) ? canal.url : linkM3u8; setLinkM3u8(url); } return; }
    const url = await obtenerUrlCalidad(linkM3u8, qualityIndex);
    setLinkM3u8(url);
  }, [linkM3u8, canal, obtenerUrlCalidad]);

  const lastTapRef = useRef<number | null>(null);
  if (!panRef.current) {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        const now = Date.now();
        if (lastTapRef.current && now - lastTapRef.current < 280) { abrirFullscreen(); lastTapRef.current = null; return; }
        lastTapRef.current = now;
        if (Math.abs(g.dx) > 50 && Math.abs(g.dx) > Math.abs(g.dy)) {
          if (g.dx > 0) canalAnterior(); else canalSiguiente();
        }
      },
    });
  }

  const limpiarCaza = () => { if (timerCaza.current) { clearTimeout(timerCaza.current); timerCaza.current = null; } };

  const obtenerStreamTNT = async (url: string): Promise<string | null> => {
    const slugM = url.match(/[?&]canal=([^&]+)/i);
    const slug  = slugM ? slugM[1] : '';
    const base  = 'https://regionales.saohgdasregions.fun';
    const emb   = 'https://embed.saohgdasregions.fun';
    const UA    = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
    const intentos = [
      { url, referer: `${emb}/embed2/${slug}.html` },
      { url: `${emb}/embed2/${slug}.html`, referer: `${emb}/` },
      { url: `${base}/stream.php?canal=${slug}`, referer: `${emb}/embed2/${slug}.html` },
    ];
    for (const { url: u, referer } of intentos) {
      try {
        const res  = await fetch(u, { headers: { 'User-Agent': UA, 'Referer': referer, 'Origin': emb } });
        const html = await res.text();
        const m    = html.match(/https?:\/\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/i);
        if (m) return m[0];
      } catch (_) {}
    }
    return null;
  };

  const sintonizar = async (c: Canal) => {
    limpiarCaza(); setLinkM3u8(null); setCanal(c); setTntBuscando(false);
    setTntWebView(false); setCazando(false); setQualities([]); setSelectedQuality(-1);
    setRecents(prev => [c, ...prev.filter(x => x.id !== c.id)].slice(0, 8));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (esUrlManifiesto(c.url)) { setLinkM3u8(c.url); detectarCalidades(c.url); return; }
    if (c.needsWebView) {
      tntRetry.current = 0; setTntBuscando(true);
      const stream = await obtenerStreamTNT(c.url);
      if (stream) { setLinkM3u8(stream); setTntBuscando(false); detectarCalidades(stream); }
      else {
        setTntWebView(true); setTntBuscando(false);
        timerCaza.current = setTimeout(() => {
          setTntBuscando(false); setTntWebView(false); limpiarCaza();
          Alert.alert(c.name, 'Canal offline o inaccesible.');
        }, 26000);
      }
      return;
    }
    setCazando(true);
    timerCaza.current = setTimeout(() => setCazando(false), 15000);
  };

  const reextraerTNT = useCallback(async () => {
    if (tntRetry.current >= 4) { setLinkM3u8(null); setTntBuscando(false); setTntWebView(false); return; }
    tntRetry.current++; setLinkM3u8(null); setTntBuscando(true); setTntWebView(false);
    await new Promise(r => setTimeout(r, 1500));
    const stream = await obtenerStreamTNT(canalRef.current?.url ?? '');
    if (stream) { setLinkM3u8(stream); setTntBuscando(false); detectarCalidades(stream); }
    else {
      setTntBuscando(false); setTntWebView(true);
      timerCaza.current = setTimeout(() => { setTntBuscando(false); setTntWebView(false); limpiarCaza(); }, 26000);
    }
  }, [detectarCalidades]);

  const onMsgTNT = useCallback((e: WebViewMessageEvent) => {
    const data = String(e.nativeEvent.data || '').trim();
    if (data.startsWith('FOUND_MANIFEST:')) {
      const url = data.replace('FOUND_MANIFEST:', '');
      setLinkM3u8(url); setTntBuscando(false); setTntWebView(false); limpiarCaza(); detectarCalidades(url); return;
    }
    if (esUrlManifiesto(data)) {
      setLinkM3u8(data); setTntBuscando(false); setTntWebView(false); limpiarCaza(); detectarCalidades(data); return;
    }
    if (data === 'MANIFEST_TIMEOUT') {
      setTntBuscando(false); setTntWebView(false); limpiarCaza();
      Alert.alert('Canal', 'No se pudo extraer el stream.');
    }
  }, [detectarCalidades]);

  const onMsgWebView = useCallback((e: WebViewMessageEvent) => {
    const m = extraerManifiesto(String(e.nativeEvent.data || ''));
    if (m) { setLinkM3u8(m); setCazando(false); limpiarCaza(); detectarCalidades(m); }
  }, [detectarCalidades]);

  const canalSiguiente = () => {
    const l = listaCanales; if (!canal || !l.length) return;
    sintonizar(l[(l.findIndex(c => c.id === canal.id) + 1) % l.length]);
  };
  const canalAnterior = () => {
    const l = listaCanales; if (!canal || !l.length) return;
    const i = l.findIndex(c => c.id === canal.id);
    sintonizar(l[i === 0 ? l.length - 1 : i - 1]);
  };

  const alMarcrarNumero = (txt: string) => {
    const n = txt.replace(/[^0-9]/g, '');
    if (!n) return;
    setNumeroMarcado(n);
    if (timerZap.current) clearTimeout(timerZap.current);
    timerZap.current = setTimeout(() => {
      const found = listaCanales.find(c => c.numero === parseInt(n, 10));
      if (found) sintonizar(found);
      else { setErrorCanal(true); setTimeout(() => setErrorCanal(false), 1800); }
      setNumeroMarcado('');
    }, 1400);
  };

  const onPlayerError = useCallback(() => {
    if (canal?.needsWebView) { reextraerTNT(); return; }
    setLinkM3u8(null); limpiarCaza();
    setTimeout(() => { if (canalRef.current) sintonizar(canalRef.current); }, 500);
  }, [canal, reextraerTNT]);

  const abrirFullscreen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFullscreen(true);
  };

  const canalesFiltrados = listaCanales.filter(c => {
    const matchCat = catActiva === 'Todos' ? true : catActiva === 'Favoritos' ? favorites.includes(c.id) : c.category === catActiva;
    return matchCat && c.name.toLowerCase().includes(busqueda.toLowerCase());
  });

  return (
    <View style={{ flex: 1 }}>
      <TextInput ref={inputRef} value={numeroMarcado} onChangeText={alMarcrarNumero}
        keyboardType="numeric" showSoftInputOnFocus={false}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />

      {/* FIX: Fullscreen con soporte WebView */}
      {fullscreen && (
        <FullscreenLive
          url={linkM3u8}
          canal={canal}
          aspect={aspect}
          onAspectToggle={() => setAspect(a => a === 'contain' ? 'fill' : 'contain')}
          qualities={qualities}
          selectedQuality={selectedQuality}
          onSelectQuality={cambiarCalidad}
          onClose={() => setFullscreen(false)}
          onPlayerError={onPlayerError}
          onPlayerStall={reextraerTNT}
          primaryColor={primaryColor}
          needsWebView={canal?.needsWebView}
          webViewUri={canal?.needsWebView ? canal.url : undefined}
          onWebViewMessage={onMsgTNT}
        />
      )}

      {/* Player inline */}
      <View style={[lv.playerBox, { height: LIVE_PLAYER_H }]} {...panRef.current.panHandlers}>
        {tntBuscando ? (
          <View style={lv.noSignal}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={[lv.noSignalTxt, { marginTop: 12 }]}>Conectando a {canal?.name ?? 'canal'}…</Text>
          </View>
        ) : tntWebView && canal?.needsWebView ? (
          /* FIX: Mostrar WebView inline cuando no se pudo extraer el m3u8 */
          <WebView
            ref={tntWebViewRef}
            source={{ uri: canal.url }}
            style={StyleSheet.absoluteFill}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mixedContentMode="always"
            injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE}
            injectedJavaScript={INJECT_AFTER}
            onMessage={onMsgTNT}
          />
        ) : linkM3u8 ? (
          <ReproductorNativo url={linkM3u8} contentFit={aspect} isLive onError={onPlayerError} onStall={reextraerTNT} />
        ) : cazando ? (
          <View style={lv.noSignal}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={[lv.noSignalTxt, { marginTop: 12 }]}>Buscando señal…</Text>
          </View>
        ) : (
          <View style={lv.noSignal}>
            <Ionicons name="tv-outline" size={48} color={T.color.textMuted} />
            <Text style={lv.noSignalTxt}>Sin señal</Text>
          </View>
        )}

        <TouchableOpacity style={lv.navLeft}  onPress={canalAnterior}><Ionicons name="chevron-back"    size={24} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
        <TouchableOpacity style={lv.navRight} onPress={canalSiguiente}><Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" /></TouchableOpacity>

        <View style={lv.topBar} pointerEvents="box-none">
          {canal && (
            <View style={lv.livePill}>
              <Animated.View style={[lv.liveDot, { opacity: liveDot, backgroundColor: T.color.live }]} />
              <Text style={lv.liveTxt}>EN VIVO</Text>
            </View>
          )}
          <View style={lv.topBarRight}>
            {qualities.length > 0 && (
              <TouchableOpacity style={lv.iconBtn} onPress={() => setQualityOpen(v => !v)}>
                <Ionicons name="layers-outline" size={15} color="#fff" />
                <Text style={lv.qualityInlineTxt}>{selectedQuality < 0 ? 'Auto' : qualities[selectedQuality]?.label}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={lv.iconBtn} onPress={() => setAspect(a => a === 'contain' ? 'fill' : 'contain')}>
              <Ionicons name="scan-outline" size={17} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={lv.iconBtn} onPress={abrirFullscreen}>
              <Ionicons name="expand-outline" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={lv.bottomBar} pointerEvents="none">
          {canal && (
            <View style={lv.channelInfoRow}>
              <Text style={[lv.chNum, { color: primaryColor }]}>{canal.numero}</Text>
              <View style={{ flex: 1, marginLeft: T.space.sm }}>
                <Text style={lv.chName} numberOfLines={1}>{canal.name}</Text>
                {canal.nowPlaying && <Text style={lv.chNow} numberOfLines={1}>▶ {canal.nowPlaying}</Text>}
              </View>
            </View>
          )}
        </View>

        {numeroMarcado !== '' && (
          <View style={lv.osd}><Text style={[lv.osdTxt, { color: primaryColor }]}>{numeroMarcado}</Text></View>
        )}
        {errorCanal && (
          <View style={lv.osdError}><Text style={lv.osdErrTxt}>CANAL NO ENCONTRADO</Text></View>
        )}
      </View>

      {/* Quality popup */}
      {qualityOpen && qualities.length > 0 && (
        <View style={lv.qualityPopup}>
          <Text style={lv.qualityTitle}>Calidad de video</Text>
          {[{ label: 'Auto (recomendado)', index: -1 }, ...qualities].map(q => (
            <TouchableOpacity key={q.index} style={[lv.qualityOption, selectedQuality === q.index && { backgroundColor: primaryColor }]} onPress={() => cambiarCalidad(q.index)}>
              <Text style={lv.qualityOptionTxt}>{q.label}</Text>
              {selectedQuality === q.index && <Ionicons name="checkmark" size={15} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recientes */}
      {recents.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={lv.recentsRow} contentContainerStyle={{ paddingHorizontal: T.space.lg }}>
          {recents.map(ch => (
            <TouchableOpacity key={ch.id} style={[lv.recentChip, canal?.id === ch.id && { backgroundColor: primaryColor }]} onPress={() => sintonizar(ch)}>
              <Text style={[lv.recentTxt, canal?.id === ch.id && { color: '#fff' }]}>{ch.numero} {ch.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Búsqueda */}
      <View style={lv.searchRow}>
        <Ionicons name="search" size={15} color={T.color.textMuted} style={{ marginRight: T.space.sm }} />
        <TextInput style={lv.searchInput} placeholder="Buscar canal..." placeholderTextColor={T.color.textMuted} value={busqueda} onChangeText={setBusqueda} />
        {busqueda !== '' && <TouchableOpacity onPress={() => setBusqueda('')}><Ionicons name="close-circle" size={17} color={T.color.textMuted} /></TouchableOpacity>}
      </View>

      {/* Categorías */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={lv.catRow} contentContainerStyle={{ paddingHorizontal: T.space.lg }}>
        {categorias.map(cat => (
          <TouchableOpacity key={cat} onPress={() => { setCatActiva(cat); Haptics.selectionAsync(); }}
            style={[lv.catChip, catActiva === cat && { backgroundColor: primaryColor }]}>
            <Text style={[lv.catTxt, catActiva === cat && { color: '#fff', fontWeight: T.font.semibold }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista canales */}
      {loadingChannels ? (
        <View style={{ paddingHorizontal: T.space.lg, gap: T.space.sm, paddingTop: T.space.sm }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Shimmer w={s(36)} h={s(24)} style={{ marginRight: T.space.md }} />
              <Shimmer w={s(150)} h={s(13)} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={canalesFiltrados}
          keyExtractor={item => item.id}
          getItemLayout={(_, i) => ({ length: s(66), offset: s(66) * i, index: i })}
          contentContainerStyle={{ paddingHorizontal: T.space.lg, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
          renderItem={({ item }) => {
            const active = canal?.id === item.id;
            const fav    = favorites.includes(item.id);
            return (
              <TouchableOpacity
                style={[lv.channelRow, active && { borderColor: primaryColor, borderLeftWidth: 3, backgroundColor: T.color.surfaceElevated }]}
                onPress={() => sintonizar(item)} activeOpacity={0.78}>
                <View style={[lv.numBadge, { backgroundColor: active ? primaryColor : T.color.surfaceElevated }]}>
                  <Text style={[lv.numTxt, { color: active ? '#fff' : T.color.textSecondary }]}>{item.numero}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[lv.rowName, active && { color: '#fff', fontWeight: T.font.semibold }]} numberOfLines={1}>{item.name}</Text>
                  {item.nowPlaying && <Text style={lv.rowNow} numberOfLines={1}>{item.nowPlaying}</Text>}
                </View>
                <TouchableOpacity onPress={() => setFavorites(fav ? favorites.filter(id => id !== item.id) : [...favorites, item.id])} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={fav ? 'star' : 'star-outline'} size={17} color={fav ? T.color.gold : T.color.textMuted} />
                </TouchableOpacity>
                {item.logo
                  ? <Image source={{ uri: item.logo }} style={lv.logo} />
                  : <View style={lv.logoPlaceholder}><Ionicons name="tv" size={13} color={T.color.textMuted} /></View>
                }
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* WebView oculta para canales normales (cazador de m3u8) */}
      {cazando && canal && !canal.needsWebView && (
        <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
          <WebView ref={webViewRef}
            source={{ uri: canal.url, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'es-ES,es;q=0.9' } }}
            originWhitelist={['*']} javaScriptEnabled domStorageEnabled cacheEnabled={false}
            mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback mixedContentMode="always"
            injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE} injectedJavaScript={INJECT_AFTER}
            onMessage={onMsgWebView} />
        </View>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════
   VOD SECTION — Películas / Series
   FIX PRINCIPAL: race condition al abrir fullscreen
═══════════════════════════════════════════════════════════ */
const VodPlayerSection = memo(({ tipo, primaryColor }: { tipo: 'movie' | 'tv'; primaryColor: string }) => {
  const driveKey  = tipo === 'movie' ? DRIVE_FOLDER_PELICULAS : DRIVE_FOLDER_SERIES;
  const cacheKey  = tipo === 'movie' ? 'driveMoviesCache' : 'driveSeriesCache';
  const storeKeyC = tipo === 'movie' ? 'customMovies' : 'customSeries';

  // FIX: estado unificado para el reproductor — evita race conditions
  const [vodState, setVodState] = useState<{
    url: string; item: MediaItem; episodioActual?: string; episodios: EpisodeItem[];
  } | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [aspect,         setAspect]         = useState<'contain' | 'fill'>('contain');

  const [categoria,        setCategoria]        = useState<'popular' | 'top_rated' | 'drive' | 'custom'>('drive');
  const [tmdbItems,        setTmdbItems]        = useState<MediaItem[]>(tipo === 'movie' ? MOVIES_FALLBACK : SERIES_FALLBACK);
  const [loadingTmdb,      setLoadingTmdb]      = useState(false);
  const [tmdbPage,         setTmdbPage]         = useState(1);
  const [driveItems,       setDriveItems]       = useState<MediaItem[]>([]);
  const [loadingDrive,     setLoadingDrive]     = useState(false);
  const [customItems,      setCustomItems]      = usePersistedState<MediaItem[]>(storeKeyC, []);
  const [watchlist,        setWatchlist]        = usePersistedState<string[]>(`watchlist_${tipo}`, []);

  const [detailItem,       setDetailItem]       = useState<MediaItem | null>(null);
  const [detailOpen,       setDetailOpen]       = useState(false);
  const [episodios,        setEpisodios]        = useState<EpisodeItem[]>([]);
  const [loadingEpisodios, setLoadingEpisodios] = useState(false);
  const [episodiosOpen,    setEpisodiosOpen]    = useState(false);
  const [temporadaActiva,  setTemporadaActiva]  = useState(1);

  const [addOpen,    setAddOpen]    = useState(false);
  const [addTitle,   setAddTitle]   = useState('');
  const [addPoster,  setAddPoster]  = useState('');
  const [addStream,  setAddStream]  = useState('');
  const [addYear,    setAddYear]    = useState('');
  const [addSeasons, setAddSeasons] = useState('');

  useEffect(() => { if (categoria === 'drive' && driveItems.length === 0) cargarDrive(); }, [categoria]);
  useEffect(() => { if (categoria === 'popular' || categoria === 'top_rated') fetchTmdb(categoria, 1); }, [categoria]);

  const fetchTmdb = async (cat: string, page: number) => {
    setLoadingTmdb(true);
    const base = tipo === 'movie' ? 'movie' : 'tv';
    const ep   = cat === 'popular' ? 'popular' : 'top_rated';
    try {
      const res  = await fetch(`https://api.themoviedb.org/3/${base}/${ep}?api_key=${TMDB_API_KEY}&language=es&page=${page}`);
      const data = await res.json();
      const formatted: MediaItem[] = (data.results || []).map((m: any) => ({
        id: m.id.toString(),
        title: tipo === 'movie' ? m.title : m.name,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750.png?text=Sin+Imagen',
        backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : undefined,
        year: tipo === 'movie' ? (m.release_date ? new Date(m.release_date).getFullYear() : undefined) : (m.first_air_date ? new Date(m.first_air_date).getFullYear() : undefined),
        rating: m.vote_average?.toFixed(1) ?? '0.0',
        seasons: tipo === 'tv' ? m.number_of_seasons : undefined,
        overview: m.overview, type: tipo,
      }));
      if (page === 1) setTmdbItems(formatted); else setTmdbItems(prev => [...prev, ...formatted]);
    } catch { if (page === 1) setTmdbItems(tipo === 'movie' ? MOVIES_FALLBACK : SERIES_FALLBACK); }
    finally { setLoadingTmdb(false); }
  };

  const cargarDrive = async () => {
    setLoadingDrive(true);
    const items = await cargarCarpetaDrive(driveKey, tipo, cacheKey);
    setDriveItems(items);
    setLoadingDrive(false);
  };

  const abrirEpisodios = async (item: MediaItem) => {
    if (!item.seasonFolderId) { if (item.streamUrl) reproducir(item); return; }
    setDetailOpen(false); setEpisodiosOpen(true); setDetailItem(item);
    setLoadingEpisodios(true); setEpisodios([]); setTemporadaActiva(1);
    try {
      const eps = await cargarEpisodiosSerie(item.seasonFolderId);
      setEpisodios(eps);
      if (eps.length > 0) setTemporadaActiva(eps[0].season);
    } catch { Alert.alert('Error', 'No se pudieron cargar los episodios.'); }
    finally { setLoadingEpisodios(false); }
  };

  // FIX: reproducir ahora actualiza vodState de forma atómica antes de abrir fullscreen
  const reproducir = useCallback((item: MediaItem, ep?: EpisodeItem, eps?: EpisodeItem[]) => {
    const url = ep ? ep.streamUrl : item.streamUrl;
    if (!url) { Alert.alert('Sin reproducción', 'Este contenido no tiene URL de stream disponible.'); return; }
    const episodiosList = eps ?? (tipo === 'tv' ? episodios : []);
    setVodState({ url, item, episodioActual: ep?.id, episodios: episodiosList });
    setDetailOpen(false);
    setEpisodiosOpen(false);
    setShowFullscreen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [episodios, tipo]);

  // FIX: cambio de episodio desde el reproductor fullscreen
  const handleSelectEpisodio = useCallback((ep: EpisodeItem) => {
    setVodState(prev => prev ? { ...prev, url: ep.streamUrl, episodioActual: ep.id } : null);
  }, []);

  const cerrarVod = () => {
    setShowFullscreen(false);
    // No limpiar vodState inmediatamente para evitar flash
    setTimeout(() => setVodState(null), 300);
  };

  const handleAddItem = () => {
    if (!addTitle.trim()) { Alert.alert('Error', 'El título es obligatorio.'); return; }
    const item: MediaItem = {
      id: Date.now().toString(), title: addTitle.trim(),
      poster: addPoster.trim() || 'https://via.placeholder.com/500x750.png?text=Sin+Imagen',
      streamUrl: addStream.trim(), year: addYear ? parseInt(addYear) : new Date().getFullYear(),
      rating: '0.0', seasons: tipo === 'tv' && addSeasons ? parseInt(addSeasons) : undefined,
      type: tipo, custom: true,
    };
    setCustomItems([item, ...customItems]);
    setAddOpen(false); setAddTitle(''); setAddPoster(''); setAddStream(''); setAddYear(''); setAddSeasons('');
  };

  const datos = categoria === 'drive' ? driveItems : categoria === 'custom' ? customItems : tmdbItems;
  const cargando = categoria === 'drive' ? loadingDrive : loadingTmdb;
  const temporadas = [...new Set(episodios.map(e => e.season))].sort((a, b) => a - b);
  const episodiosFiltrados = episodios.filter(e => e.season === temporadaActiva);

  return (
    <View style={{ flex: 1 }}>

      {/* FIX: Fullscreen VOD — solo se monta cuando vodState está listo */}
      {showFullscreen && vodState && (
        <FullscreenVOD
          url={vodState.url}
          item={vodState.item}
          episodios={vodState.episodios}
          episodioActual={vodState.episodioActual}
          onSelectEpisodio={handleSelectEpisodio}
          onClose={cerrarVod}
          primaryColor={primaryColor}
        />
      )}

      {/* Mini player cuando NO está en fullscreen */}
      {vodState && !showFullscreen && (
        <View style={[vd.playerBox, { height: VOD_PLAYER_H }]}>
          <ReproductorVOD
            url={vodState.url}
            contentFit={aspect}
            episodios={vodState.episodios}
            episodioActual={vodState.episodioActual}
            onSelectEpisodio={handleSelectEpisodio}
            serieTitle={vodState.item.title}
            primaryColor={primaryColor}
          />
          <View style={vd.playerControls} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', gap: T.space.sm }}>
              <TouchableOpacity style={lv.iconBtn} onPress={() => setAspect(a => a === 'contain' ? 'fill' : 'contain')}>
                <Ionicons name="scan-outline" size={17} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={lv.iconBtn} onPress={() => setShowFullscreen(true)}>
                <Ionicons name="expand-outline" size={17} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={lv.iconBtn} onPress={cerrarVod}>
                <Ionicons name="close" size={17} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={vd.playerInfo} pointerEvents="none">
            <Image source={{ uri: vodState.item.poster }} style={vd.miniPoster} />
            <View style={{ flex: 1, marginLeft: T.space.sm }}>
              <Text style={vd.vodTitle} numberOfLines={1}>{vodState.item.title}</Text>
              <Text style={vd.vodMeta}>{vodState.item.year}{tipo === 'tv' && vodState.item.seasons ? ` · ${vodState.item.seasons} temp.` : ''}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Categorías */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={lv.catRow} contentContainerStyle={{ paddingHorizontal: T.space.lg }}>
          {([
            { key: 'drive',     label: '📁 Mi Drive' },
            { key: 'popular',   label: '🔥 Populares' },
            { key: 'top_rated', label: '⭐ Mejor valoradas' },
            { key: 'custom',    label: '➕ Mi contenido' },
          ] as const).map(({ key, label }) => (
            <TouchableOpacity key={key} onPress={() => { setCategoria(key); setTmdbPage(1); }}
              style={[lv.catChip, categoria === key && { backgroundColor: primaryColor }]}>
              <Text style={[lv.catTxt, categoria === key && { color: '#fff', fontWeight: T.font.semibold }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {categoria === 'custom' && (
          <TouchableOpacity style={[vd.addBtn, { backgroundColor: primaryColor }]} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {addOpen && (
        <View style={vd.addForm}>
          <Text style={vd.addFormTitle}>Agregar {tipo === 'movie' ? 'Película' : 'Serie'}</Text>
          <TextInput style={vd.addInput} placeholder="Título *" placeholderTextColor={T.color.textMuted} value={addTitle} onChangeText={setAddTitle} />
          <TextInput style={vd.addInput} placeholder="URL del poster" placeholderTextColor={T.color.textMuted} value={addPoster} onChangeText={setAddPoster} />
          <TextInput style={vd.addInput} placeholder="URL de reproducción (m3u8, mp4, etc.)" placeholderTextColor={T.color.textMuted} value={addStream} onChangeText={setAddStream} autoCapitalize="none" />
          <TextInput style={vd.addInput} placeholder="Año" placeholderTextColor={T.color.textMuted} value={addYear} onChangeText={setAddYear} keyboardType="numeric" />
          {tipo === 'tv' && <TextInput style={vd.addInput} placeholder="Temporadas" placeholderTextColor={T.color.textMuted} value={addSeasons} onChangeText={setAddSeasons} keyboardType="numeric" />}
          <View style={{ flexDirection: 'row', gap: T.space.sm, marginTop: T.space.sm }}>
            <TouchableOpacity style={[vd.addBtnSmall, { backgroundColor: primaryColor, flex: 1 }]} onPress={handleAddItem}>
              <Text style={{ color: '#fff', fontWeight: T.font.bold }}>Agregar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[vd.addBtnSmall, { backgroundColor: T.color.surfaceElevated, flex: 1 }]} onPress={() => setAddOpen(false)}>
              <Text style={{ color: T.color.textSecondary }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Grid */}
      {cargando ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={{ color: T.color.textMuted, marginTop: 10 }}>{categoria === 'drive' ? 'Cargando tu Drive…' : 'Cargando…'}</Text>
        </View>
      ) : datos.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={categoria === 'drive' ? 'cloud-outline' : 'film-outline'} size={48} color={T.color.textMuted} />
          <Text style={{ color: T.color.textMuted, marginTop: 10, fontSize: T.font.sm }}>
            {categoria === 'drive' ? 'No hay videos en tu Drive' : 'Sin contenido aquí'}
          </Text>
          {categoria === 'drive' && (
            <TouchableOpacity style={[vd.addBtnSmall, { backgroundColor: primaryColor, marginTop: T.space.md }]} onPress={cargarDrive}>
              <Text style={{ color: '#fff', fontWeight: T.font.bold }}>Recargar</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={datos}
          keyExtractor={item => item.id}
          numColumns={MEDIA_COLS}
          contentContainerStyle={{ paddingHorizontal: T.space.md, paddingBottom: 24, paddingTop: T.space.sm }}
          columnWrapperStyle={MEDIA_COLS > 1 ? { gap: T.space.sm, marginBottom: T.space.sm } : undefined}
          refreshControl={categoria === 'drive' ? <RefreshControl refreshing={loadingDrive} onRefresh={cargarDrive} tintColor={primaryColor} /> : undefined}
          onEndReached={() => {
            if (categoria === 'popular' || categoria === 'top_rated') {
              const next = tmdbPage + 1; setTmdbPage(next); fetchTmdb(categoria, next);
            }
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => {
            const isSerie = tipo === 'tv' && item.seasonFolderId;
            const isPlaying = vodState?.item?.id === item.id;
            return (
              <TouchableOpacity style={vd.card} onPress={() => { setDetailItem(item); setDetailOpen(true); }} activeOpacity={0.85}>
                <Image source={{ uri: item.poster }} style={vd.poster} resizeMode="cover" />
                <View style={vd.cardOverlay} />
                {isPlaying && (
                  <View style={[vd.playingBadge, { backgroundColor: primaryColor }]}>
                    <Ionicons name="play" size={9} color="#fff" />
                  </View>
                )}
                {(isSerie || item.custom) && (
                  <View style={[vd.customBadge, isSerie && { backgroundColor: '#7C3AED88' }]}>
                    <Text style={vd.customBadgeTxt}>{isSerie ? 'SERIE' : 'DRIVE'}</Text>
                  </View>
                )}
                <View style={vd.cardBottom}>
                  <Text style={vd.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {item.rating && item.rating !== '0.0' && (
                    <View style={[vd.ratingPill, { backgroundColor: primaryColor + '25' }]}>
                      <Text style={[vd.ratingTxt, { color: primaryColor }]}>⭐ {item.rating}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Detail Modal */}
      {detailItem && (
        <Modal visible={detailOpen} animationType="slide" transparent={false}>
          <View style={{ flex: 1, backgroundColor: T.color.bg }}>
            <StatusBar hidden />
            <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
              {(detailItem.backdrop || detailItem.poster) && (
                <Image source={{ uri: detailItem.backdrop ?? detailItem.poster }} style={vd.detailHero} resizeMode="cover" />
              )}
              <View style={vd.detailGradient} />
              <TouchableOpacity style={vd.detailClose} onPress={() => setDetailOpen(false)}>
                <Ionicons name="chevron-down-circle" size={38} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              <View style={vd.detailBody}>
                <View style={{ flexDirection: 'row', gap: T.space.md, marginBottom: T.space.lg }}>
                  <Image source={{ uri: detailItem.poster }} style={vd.detailPoster} resizeMode="cover" />
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <Text style={vd.detailTitle}>{detailItem.title}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm, marginTop: T.space.xs }}>
                      {detailItem.rating && detailItem.rating !== '0.0' && (
                        <View style={[vd.ratingPill, { backgroundColor: primaryColor + '25' }]}>
                          <Text style={[vd.ratingTxt, { color: primaryColor }]}>⭐ {detailItem.rating}</Text>
                        </View>
                      )}
                      {detailItem.year && <Text style={vd.detailMeta}>{detailItem.year}</Text>}
                      {detailItem.seasons && <Text style={vd.detailMeta}>{detailItem.seasons} temp.</Text>}
                    </View>
                  </View>
                </View>
                <Text style={vd.detailOverview}>{detailItem.overview ?? 'Sin descripción.'}</Text>
                <View style={{ flexDirection: 'row', gap: T.space.sm, marginTop: T.space.lg }}>
                  {detailItem.seasonFolderId ? (
                    <TouchableOpacity style={[vd.detailBtn, { backgroundColor: primaryColor, flex: 2 }]} onPress={() => abrirEpisodios(detailItem)}>
                      <Ionicons name="play-circle" size={19} color="#fff" />
                      <Text style={vd.detailBtnTxt}>Ver episodios</Text>
                    </TouchableOpacity>
                  ) : detailItem.streamUrl ? (
                    <TouchableOpacity style={[vd.detailBtn, { backgroundColor: primaryColor, flex: 2 }]} onPress={() => reproducir(detailItem)}>
                      <Ionicons name="play-circle" size={19} color="#fff" />
                      <Text style={vd.detailBtnTxt}>Reproducir</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[vd.detailBtn, { backgroundColor: T.color.surfaceHigh, flex: 2, opacity: 0.6 }]}>
                      <Ionicons name="cloud-offline-outline" size={19} color={T.color.textMuted} />
                      <Text style={[vd.detailBtnTxt, { color: T.color.textMuted }]}>Sin stream disponible</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[vd.detailBtn, { backgroundColor: watchlist.includes(detailItem.id) ? primaryColor + 'AA' : T.color.surfaceElevated, flex: 1 }]}
                    onPress={() => setWatchlist(watchlist.includes(detailItem.id) ? watchlist.filter(id => id !== detailItem.id) : [...watchlist, detailItem.id])}>
                    <Ionicons name={watchlist.includes(detailItem.id) ? 'checkmark-circle' : 'add-circle-outline'} size={18} color="#fff" />
                    <Text style={vd.detailBtnTxt}>{watchlist.includes(detailItem.id) ? 'En lista' : 'Mi lista'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Modal Episodios */}
      <Modal visible={episodiosOpen} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: T.color.bg }}>
          <StatusBar barStyle="light-content" backgroundColor={T.color.bg} />
          <View style={ep.header}>
            <TouchableOpacity onPress={() => setEpisodiosOpen(false)} style={{ marginRight: T.space.md }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={ep.serieTitle} numberOfLines={1}>{detailItem?.title}</Text>
              <Text style={ep.serieSubtitle}>{episodios.length} episodio{episodios.length !== 1 ? 's' : ''}</Text>
            </View>
            {detailItem?.poster && <Image source={{ uri: detailItem.poster }} style={ep.miniPoster} />}
          </View>
          {temporadas.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ep.seasonRow} contentContainerStyle={{ paddingHorizontal: T.space.lg }}>
              {temporadas.map(t => (
                <TouchableOpacity key={t} style={[ep.seasonChip, temporadaActiva === t && { backgroundColor: primaryColor }]} onPress={() => setTemporadaActiva(t)}>
                  <Text style={[ep.seasonChipTxt, temporadaActiva === t && { color: '#fff' }]}>{t === 0 ? 'Especiales' : `Temporada ${t}`}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {loadingEpisodios ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ color: T.color.textMuted, marginTop: 10 }}>Cargando episodios…</Text>
            </View>
          ) : episodiosFiltrados.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="film-outline" size={48} color={T.color.textMuted} />
              <Text style={{ color: T.color.textMuted, marginTop: 10 }}>Sin episodios en esta temporada</Text>
            </View>
          ) : (
            <FlatList
              data={episodiosFiltrados}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingHorizontal: T.space.lg, paddingBottom: 32 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={ep.episodeRow}
                  onPress={() => { if (detailItem) reproducir(detailItem, item, episodios); }}
                  activeOpacity={0.78}>
                  <View style={[ep.epNumBadge, { backgroundColor: primaryColor + '22' }]}>
                    <Text style={[ep.epNum, { color: primaryColor }]}>
                      {item.episode > 0 ? `E${String(item.episode).padStart(2, '0')}` : '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: T.space.md }}>
                    <Text style={ep.epTitle} numberOfLines={2}>{item.name}</Text>
                    <Text style={ep.epMeta}>{item.season > 0 ? `T${item.season}` : 'Especial'}{item.episode > 0 ? ` · E${item.episode}` : ''}</Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={30} color={primaryColor} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════
   AJUSTES
═══════════════════════════════════════════════════════════ */
const AjustesSection = ({ primaryColor, accentColor, setAccentColor, onRefreshChannels }: any) => {
  const [appId, setAppId] = useState('');
  useEffect(() => {
    AsyncStorage.getItem('appId').then(id => {
      if (!id) { id = 'NXTV-' + Math.random().toString(36).substr(2, 6).toUpperCase(); AsyncStorage.setItem('appId', id); }
      setAppId(id ?? '');
    });
  }, []);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }}>
      <View style={aj.heroSection}>
        <View style={aj.heroLogo}>
          <Text style={aj.heroLogoTxt}>N</Text>
        </View>
        <Text style={aj.heroTitle}>NEXUS<Text style={{ color: primaryColor }}>TV</Text></Text>
        <Text style={aj.heroSub}>Configuración del sistema</Text>
      </View>

      <Text style={aj.sectionTitle}>PERSONALIZACIÓN</Text>
      <View style={aj.card}>
        <Text style={aj.label}>Color de acento</Text>
        <View style={{ flexDirection: 'row', gap: T.space.md, marginTop: T.space.md }}>
          {Object.entries(ACCENT_COLORS).map(([key, color]) => (
            <TouchableOpacity key={key} onPress={() => { setAccentColor(key); Haptics.selectionAsync(); }}
              style={[aj.colorDot, { backgroundColor: color, transform: [{ scale: accentColor === key ? 1.25 : 1 }] },
                accentColor === key && { borderWidth: 3, borderColor: '#fff', shadowColor: color, shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 }]}>
              {accentColor === key && <Ionicons name="checkmark" size={14} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={aj.sectionTitle}>REPRODUCCIÓN</Text>
      <View style={aj.card}>
        <View style={aj.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={aj.label}>Pantalla completa automática</Text>
            <Text style={aj.cardSub}>Al reproducir, abre directamente en fullscreen landscape</Text>
          </View>
          <View style={[aj.badge, { backgroundColor: primaryColor + '22' }]}>
            <Text style={[aj.badgeTxt, { color: primaryColor }]}>Activo</Text>
          </View>
        </View>
      </View>
      <View style={aj.card}>
        <View style={aj.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={aj.label}>Episodios en reproductor</Text>
            <Text style={aj.cardSub}>Navega entre episodios sin salir del reproductor</Text>
          </View>
          <View style={[aj.badge, { backgroundColor: primaryColor + '22' }]}>
            <Text style={[aj.badgeTxt, { color: primaryColor }]}>Activo</Text>
          </View>
        </View>
      </View>
      <View style={aj.card}>
        <View style={aj.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={aj.label}>WebView en fullscreen (TV en vivo)</Text>
            <Text style={aj.cardSub}>Canales que necesitan web se ven en pantalla completa</Text>
          </View>
          <View style={[aj.badge, { backgroundColor: primaryColor + '22' }]}>
            <Text style={[aj.badgeTxt, { color: primaryColor }]}>Activo</Text>
          </View>
        </View>
      </View>

      <Text style={aj.sectionTitle}>CANALES</Text>
      <TouchableOpacity style={aj.card} onPress={onRefreshChannels}>
        <View style={aj.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={aj.label}>Actualizar lista M3U</Text>
            <Text style={aj.cardSub}>Recarga los canales en línea</Text>
          </View>
          <Ionicons name="refresh-circle" size={28} color={primaryColor} />
        </View>
      </TouchableOpacity>

      <Text style={aj.sectionTitle}>INFORMACIÓN</Text>
      <View style={aj.card}>
        <Text style={aj.label}>Identificador de dispositivo</Text>
        <Text style={[aj.value, { color: primaryColor, marginTop: 6, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }) }]} selectable>{appId}</Text>
      </View>
      <View style={aj.card}>
        <View style={aj.cardRow}><Text style={aj.label}>Versión</Text><Text style={aj.value}>4.1.0</Text></View>
      </View>
      <View style={aj.card}>
        <View style={aj.cardRow}><Text style={aj.label}>Plataforma</Text><Text style={aj.value}>{Platform.OS} {Platform.Version}</Text></View>
      </View>
      <View style={aj.card}>
        <View style={aj.cardRow}><Text style={aj.label}>Pantalla</Text><Text style={aj.value}>{Math.round(W)} × {Math.round(H)} pt</Text></View>
      </View>
    </ScrollView>
  );
};

/* ═══════════════════════════════════════════════════════════
   APP PRINCIPAL
═══════════════════════════════════════════════════════════ */
type Tab = 'live' | 'movies' | 'series' | 'settings';

export default function App() {
  const [tab,         setTab]         = useState<Tab>('live');
  const [accentColor, setAccentColor] = usePersistedState('accentColor', 'red');
  const [favorites,   setFavorites]   = usePersistedState<string[]>('favorites', []);
  const [listaCanales, setListaCanales] = useState<Canal[]>(CANALES_MANUALES);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);

  const primaryColor = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.red;

  const cargarM3U = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoadingChannels(true);
    try {
      const res  = await fetch(M3U_URL, { headers: { 'User-Agent': 'NexusTV/4.1' } });
      const text = await res.text();
      const parsed = parsearM3U(text);
      if (parsed.length > 0) setListaCanales([...CANALES_MANUALES, ...parsed]);
    } catch (e) { console.warn('Error cargando M3U:', e); }
    finally { setLoadingChannels(false); setRefreshing(false); }
  };

  function parsearM3U(text: string): Canal[] {
    const lines = text.split('\n');
    const canales: Canal[] = [];
    let numero = CANALES_MANUALES.length + 1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l.startsWith('#EXTINF')) continue;
      const url = lines[i + 1]?.trim();
      if (!url || !url.startsWith('http')) continue;
      const name     = l.match(/,(.+)$/)?.[1]?.trim() ?? `Canal ${numero}`;
      const logo     = l.match(/tvg-logo="([^"]+)"/)?.[1] ?? '';
      const category = l.match(/group-title="([^"]+)"/)?.[1] ?? 'Otros';
      canales.push({ id: `m3u-${numero}`, numero: numero++, name, url, logo, category });
      i++;
    }
    return canales;
  }

  useEffect(() => { cargarM3U(); }, []);

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'live',     icon: 'tv',          label: 'En Vivo' },
    { key: 'movies',   icon: 'film',         label: 'Películas' },
    { key: 'series',   icon: 'videocam',     label: 'Series' },
    { key: 'settings', icon: 'settings',     label: 'Ajustes' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.color.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={T.color.bg} />
      <View style={{ flex: 1 }}>
        {tab === 'live' && (
          <LivePlayerSection
            primaryColor={primaryColor}
            listaCanales={listaCanales}
            loadingChannels={loadingChannels}
            refreshing={refreshing}
            onRefresh={() => cargarM3U(true)}
            favorites={favorites}
            setFavorites={setFavorites}
          />
        )}
        {tab === 'movies' && <VodPlayerSection tipo="movie" primaryColor={primaryColor} />}
        {tab === 'series' && <VodPlayerSection tipo="tv"    primaryColor={primaryColor} />}
        {tab === 'settings' && (
          <AjustesSection
            primaryColor={primaryColor}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            onRefreshChannels={() => cargarM3U(true)}
          />
        )}
      </View>

      {/* Tab bar */}
      <View style={tb.bar}>
        {tabs.map(({ key, icon, label }) => {
          const active = tab === key;
          return (
            <TouchableOpacity key={key} style={tb.item} onPress={() => { setTab(key); Haptics.selectionAsync(); }}>
              <View style={[tb.iconWrap, active && { backgroundColor: primaryColor + '22' }]}>
                <Ionicons name={(active ? icon : `${icon}-outline`) as any} size={s(22)} color={active ? primaryColor : T.color.textMuted} />
              </View>
              <Text style={[tb.label, { color: active ? primaryColor : T.color.textMuted, fontWeight: active ? T.font.semibold : T.font.regular }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════
   ESTILOS
═══════════════════════════════════════════════════════════ */
const vc = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center' },
  centerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(28) },
  ctrlBtn: { alignItems: 'center', gap: 3 },
  ctrlLbl: { color: 'rgba(255,255,255,0.7)', fontSize: T.font.xs },
  playBtn: { width: s(64), height: s(64), borderRadius: s(32), backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  progressContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  progressBar: { flex: 1, paddingVertical: 10 },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, position: 'relative' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressThumb: { position: 'absolute', top: -5, width: 13, height: 13, borderRadius: 7, marginLeft: -6.5 },
  timeText: { color: 'rgba(255,255,255,0.8)', fontSize: T.font.xs, fontVariant: ['tabular-nums'] },
  episodioToggle: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radius.full },
  episodioToggleTxt: { color: '#fff', fontSize: T.font.sm, fontWeight: T.font.medium },
  episodioPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '42%', backgroundColor: 'rgba(8,8,20,0.97)', borderLeftWidth: 1, borderLeftColor: T.color.border, zIndex: 10 },
  episodioHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: T.color.border },
  episodioTitle: { color: T.color.textPrimary, fontSize: T.font.sm, fontWeight: T.font.semibold, flex: 1, marginRight: 8 },
  tempChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radius.full, backgroundColor: T.color.surfaceElevated, marginRight: 6 },
  tempChipTxt: { color: T.color.textSecondary, fontSize: T.font.xs, fontWeight: T.font.medium },
  epItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: T.radius.sm, borderWidth: 1, borderColor: 'transparent', marginBottom: 4 },
  epNumBadge: { width: 32, height: 32, borderRadius: T.radius.xs, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  epNumTxt: { fontSize: T.font.xs, fontWeight: T.font.bold },
  epName: { flex: 1, color: T.color.textSecondary, fontSize: T.font.xs, marginLeft: 8 },
});

const lv = StyleSheet.create({
  playerBox: { backgroundColor: '#000', position: 'relative', overflow: 'hidden' },
  noSignal: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  noSignalTxt: { color: T.color.textMuted, marginTop: 8, fontSize: T.font.sm },
  navLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  navRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: T.space.sm },
  topBarRight: { flexDirection: 'row', gap: T.space.sm },
  livePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: T.radius.full, gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveTxt: { color: '#fff', fontSize: T.font.xs, fontWeight: T.font.bold, letterSpacing: 0.8 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', padding: 6, borderRadius: T.radius.sm },
  qualityInlineTxt: { color: '#fff', fontSize: T.font.xs, fontWeight: T.font.semibold },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: T.space.sm, paddingBottom: T.space.md, background: 'transparent' },
  channelInfoRow: { flexDirection: 'row', alignItems: 'center' },
  chNum: { fontSize: T.font.xl, fontWeight: T.font.black, minWidth: 36 },
  chName: { color: '#fff', fontSize: T.font.base, fontWeight: T.font.semibold },
  chNow: { color: 'rgba(255,255,255,0.55)', fontSize: T.font.xs, marginTop: 1 },
  osd: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -40 }, { translateY: -30 }], backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: T.radius.md, paddingHorizontal: 18, paddingVertical: 8 },
  osdTxt: { fontSize: T.font.xl, fontWeight: T.font.black },
  osdError: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  osdErrTxt: { backgroundColor: 'rgba(255,0,0,0.8)', color: '#fff', fontSize: T.font.sm, paddingHorizontal: 14, paddingVertical: 5, borderRadius: T.radius.full, fontWeight: T.font.bold },
  qualityPopup: { position: 'absolute', top: LIVE_PLAYER_H + 4, right: T.space.lg, backgroundColor: T.color.surfaceElevated, borderRadius: T.radius.md, padding: T.space.md, zIndex: 20, minWidth: 180, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  qualityTitle: { color: T.color.textSecondary, fontSize: T.font.xs, fontWeight: T.font.semibold, marginBottom: 8, letterSpacing: 0.6 },
  qualityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, borderRadius: T.radius.sm, marginBottom: 3 },
  qualityOptionTxt: { color: T.color.textPrimary, fontSize: T.font.sm },
  recentsRow: { maxHeight: 44, marginTop: T.space.sm },
  recentChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: T.radius.full, backgroundColor: T.color.surfaceElevated, marginRight: 8, justifyContent: 'center' },
  recentTxt: { color: T.color.textSecondary, fontSize: T.font.xs },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.color.surfaceElevated, marginHorizontal: T.space.lg, marginTop: T.space.md, borderRadius: T.radius.full, paddingHorizontal: T.space.md, height: s(38) },
  searchInput: { flex: 1, color: T.color.textPrimary, fontSize: T.font.sm },
  catRow: { marginTop: T.space.sm, maxHeight: 42 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: T.radius.full, backgroundColor: T.color.surfaceElevated, marginRight: 8, justifyContent: 'center' },
  catTxt: { color: T.color.textSecondary, fontSize: T.font.sm },
  channelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: T.space.sm, paddingHorizontal: T.space.md, borderBottomWidth: 1, borderBottomColor: T.color.border, minHeight: s(56), gap: T.space.sm },
  numBadge: { width: s(36), height: s(24), borderRadius: T.radius.xs, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numTxt: { fontSize: T.font.xs, fontWeight: T.font.bold },
  rowName: { color: T.color.textSecondary, fontSize: T.font.sm },
  rowNow: { color: T.color.textMuted, fontSize: T.font.xs, marginTop: 1 },
  logo: { width: s(38), height: s(22), resizeMode: 'contain' },
  logoPlaceholder: { width: s(38), height: s(22), alignItems: 'center', justifyContent: 'center' },
});

const vd = StyleSheet.create({
  playerBox: { backgroundColor: '#000', position: 'relative', overflow: 'hidden' },
  playerControls: { position: 'absolute', top: T.space.sm, right: T.space.sm },
  playerInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: T.space.md, backgroundColor: 'rgba(0,0,0,0.7)' },
  miniPoster: { width: s(32), height: s(46), borderRadius: T.radius.xs },
  vodTitle: { color: '#fff', fontSize: T.font.sm, fontWeight: T.font.semibold },
  vodMeta: { color: T.color.textMuted, fontSize: T.font.xs, marginTop: 2 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: T.radius.full, marginTop: 10 },
  card: { flex: 1 / MEDIA_COLS, aspectRatio: 0.67, borderRadius: T.radius.md, overflow: 'hidden', backgroundColor: T.color.surface, position: 'relative' },
  poster: { ...StyleSheet.absoluteFillObject },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  playingBadge: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  customBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: T.radius.xs },
  customBadgeTxt: { color: '#fff', fontSize: 8, fontWeight: T.font.bold },
  cardBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: T.space.sm, backgroundColor: 'rgba(0,0,0,0.75)' },
  cardTitle: { color: '#fff', fontSize: T.font.xs, fontWeight: T.font.semibold, lineHeight: 14 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, paddingVertical: 2, borderRadius: T.radius.xs, marginTop: 3 },
  ratingTxt: { fontSize: 8, fontWeight: T.font.bold },
  addBtn: { width: 36, height: 36, borderRadius: T.radius.full, alignItems: 'center', justifyContent: 'center', marginRight: T.space.lg },
  addForm: { backgroundColor: T.color.surfaceElevated, marginHorizontal: T.space.lg, borderRadius: T.radius.lg, padding: T.space.lg, marginBottom: T.space.md },
  addFormTitle: { color: T.color.textPrimary, fontSize: T.font.md, fontWeight: T.font.bold, marginBottom: T.space.md },
  addInput: { backgroundColor: T.color.surfaceHigh, borderRadius: T.radius.md, paddingHorizontal: T.space.md, paddingVertical: T.space.sm, color: T.color.textPrimary, fontSize: T.font.sm, marginBottom: T.space.sm },
  addBtnSmall: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: T.radius.md, alignItems: 'center', justifyContent: 'center' },
  detailHero: { width: '100%', height: H * 0.35 },
  detailGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: H * 0.35, backgroundColor: 'rgba(8,8,15,0.4)' },
  detailClose: { position: 'absolute', top: T.space.lg, left: T.space.lg },
  detailBody: { padding: T.space.lg, marginTop: -60 },
  detailPoster: { width: s(95), height: s(140), borderRadius: T.radius.md, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 },
  detailTitle: { color: T.color.textPrimary, fontSize: T.font.xl, fontWeight: T.font.black },
  detailMeta: { color: T.color.textSecondary, fontSize: T.font.sm, backgroundColor: T.color.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: T.radius.xs },
  detailOverview: { color: T.color.textSecondary, fontSize: T.font.sm, lineHeight: 20 },
  detailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: T.space.md, borderRadius: T.radius.lg },
  detailBtnTxt: { color: '#fff', fontSize: T.font.sm, fontWeight: T.font.semibold },
});

const ep = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: T.space.lg, paddingTop: T.space.xl, borderBottomWidth: 1, borderBottomColor: T.color.border },
  serieTitle: { color: T.color.textPrimary, fontSize: T.font.lg, fontWeight: T.font.bold },
  serieSubtitle: { color: T.color.textMuted, fontSize: T.font.xs, marginTop: 2 },
  miniPoster: { width: s(40), height: s(58), borderRadius: T.radius.sm },
  seasonRow: { maxHeight: 50, marginTop: T.space.md },
  seasonChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.radius.full, backgroundColor: T.color.surfaceElevated, marginRight: 8 },
  seasonChipTxt: { color: T.color.textSecondary, fontSize: T.font.sm, fontWeight: T.font.medium },
  episodeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: T.space.md, borderBottomWidth: 1, borderBottomColor: T.color.border },
  epNumBadge: { width: s(52), height: s(52), borderRadius: T.radius.sm, alignItems: 'center', justifyContent: 'center' },
  epNum: { fontSize: T.font.sm, fontWeight: T.font.black },
  epTitle: { color: T.color.textPrimary, fontSize: T.font.sm, fontWeight: T.font.medium },
  epMeta: { color: T.color.textMuted, fontSize: T.font.xs, marginTop: 3 },
});

const fs = StyleSheet.create({
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: T.space.md, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10 },
  topBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  topTitle: { color: '#fff', fontSize: T.font.base, fontWeight: T.font.semibold },
  topSub: { color: 'rgba(255,255,255,0.6)', fontSize: T.font.xs },
  qualityLabel: { color: '#fff', fontSize: T.font.xs, fontWeight: T.font.semibold },
  qualityPopup: { position: 'absolute', top: 60, right: T.space.lg, backgroundColor: T.color.surfaceElevated, borderRadius: T.radius.md, padding: T.space.md, zIndex: 20, minWidth: 200, shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 14, elevation: 14 },
  qualityPopupTitle: { color: T.color.textSecondary, fontSize: T.font.xs, fontWeight: T.font.semibold, marginBottom: 10, letterSpacing: 0.6 },
  qualityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: T.radius.sm, marginBottom: 3 },
  qualityOptionTxt: { color: T.color.textPrimary, fontSize: T.font.sm },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  errorTxt: { color: T.color.textMuted, fontSize: T.font.base, marginTop: 12 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: T.radius.full, marginTop: 16 },
});

const aj = StyleSheet.create({
  heroSection: { alignItems: 'center', paddingVertical: T.space.xxl, paddingTop: T.space.xl },
  heroLogo: { width: s(72), height: s(72), borderRadius: s(20), backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', marginBottom: T.space.md, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  heroLogoTxt: { fontSize: s(36), fontWeight: '900' as any, color: '#fff' },
  heroTitle: { fontSize: T.font.xxl, fontWeight: T.font.black, color: T.color.textPrimary, letterSpacing: 4 },
  heroSub: { color: T.color.textMuted, fontSize: T.font.sm, marginTop: 4, letterSpacing: 1 },
  sectionTitle: { color: T.color.textMuted, fontSize: T.font.xs, fontWeight: T.font.bold, letterSpacing: 1.5, paddingHorizontal: T.space.lg, paddingBottom: T.space.sm, paddingTop: T.space.lg },
  card: { backgroundColor: T.color.surfaceElevated, marginHorizontal: T.space.lg, borderRadius: T.radius.lg, padding: T.space.lg, marginBottom: T.space.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardSub: { color: T.color.textMuted, fontSize: T.font.xs, marginTop: 2 },
  label: { color: T.color.textPrimary, fontSize: T.font.base, fontWeight: T.font.medium },
  value: { color: T.color.textSecondary, fontSize: T.font.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: T.radius.full },
  badgeTxt: { fontSize: T.font.xs, fontWeight: T.font.bold },
  colorDot: { width: s(34), height: s(34), borderRadius: s(17), alignItems: 'center', justifyContent: 'center' },
});

const tb = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: T.color.surface, borderTopWidth: 1, borderTopColor: T.color.border, paddingBottom: Platform.OS === 'ios' ? T.space.lg : T.space.sm, paddingTop: T.space.sm },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: s(44), height: s(28), borderRadius: T.radius.full, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: T.font.xs },
});
