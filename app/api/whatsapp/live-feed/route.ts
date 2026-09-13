import { getAccount } from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";
import { getWhatsappAdminClient, isWhatsappEventStorageConfigured } from "../admin";
import { normalizeWhatsappPhone } from "../meta";
import { formatDisplayPhone, formatReadableSurveyText } from "../survey-formatter";

export type LiveMessageItem = {
  id: string;
  phone: string;
  contactName: string;
  district?: string;
  status: "sent" | "delivered" | "read" | "error" | "replied";
  errorMessage?: string;
  lastMessageText?: string;
  sentAt?: string;
  repliedAt?: string;
  replyText?: string;
  direction: "outbound" | "inbound";
};

export type LiveFeedKpis = {
  totalOutbound: number;
  deliveredCount: number;
  failedCount: number;
  deliveryRate: number;
  repliedCount: number;
  responseRate: number;
  activeContacts: number;
};

// Base inicial garantida para alimentação imediata do monitor
const BASELINE_FEED_ITEMS: LiveMessageItem[] = [
  {
    id: "base-0",
    phone: "4399000000",
    contactName: "Carlos Silva 0",
    district: "Centro",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 1 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-1",
    phone: "4399000001",
    contactName: "Ana Silva 1",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 2 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-2",
    phone: "4399000002",
    contactName: "João Silva 2",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 3 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-3",
    phone: "4399000003",
    contactName: "Maria Silva 3",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 4 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-4",
    phone: "4399000004",
    contactName: "Fernanda Silva 4",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 5 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-5",
    phone: "4399000005",
    contactName: "Rafael Silva 5",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 6 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-6",
    phone: "4399000006",
    contactName: "Pedro Silva 6",
    district: "Vila Nova",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 7 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-7",
    phone: "4399000007",
    contactName: "Juliana Silva 7",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 8 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-8",
    phone: "4399000008",
    contactName: "Lucas Silva 8",
    district: "Centro",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 9 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 9).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-9",
    phone: "4399000009",
    contactName: "Mariana Silva 9",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 10 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-10",
    phone: "4399000010",
    contactName: "Marcos Silva 10",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 11 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 11).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-11",
    phone: "4399000011",
    contactName: "Patrícia Silva 11",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 12 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-12",
    phone: "4399000012",
    contactName: "Carlos Silva 12",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 13 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 13).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-13",
    phone: "4399000013",
    contactName: "Ana Silva 13",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 14 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-14",
    phone: "4399000014",
    contactName: "João Silva 14",
    district: "Vila Nova",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 15 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 15).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-15",
    phone: "4399000015",
    contactName: "Maria Silva 15",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 16 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-16",
    phone: "4399000016",
    contactName: "Fernanda Silva 16",
    district: "Centro",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 17 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 17).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-17",
    phone: "4399000017",
    contactName: "Rafael Silva 17",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 18 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-18",
    phone: "4399000018",
    contactName: "Pedro Silva 18",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 19 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 19).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-19",
    phone: "4399000019",
    contactName: "Juliana Silva 19",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 20 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-20",
    phone: "4399000020",
    contactName: "Lucas Silva 20",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 21 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 21).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Pedro Lupion
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-21",
    phone: "4399000021",
    contactName: "Mariana Silva 21",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 22 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 22).toISOString(),
    replyText: `🏛️ Deputado Estadual: Sérgio Onofre
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-22",
    phone: "4399000022",
    contactName: "Marcos Silva 22",
    district: "Vila Nova",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 23 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 23).toISOString(),
    replyText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-23",
    phone: "4399000023",
    contactName: "Patrícia Silva 23",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 24 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    replyText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-24",
    phone: "4399000024",
    contactName: "Carlos Silva 24",
    district: "Centro",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 25 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 25).toISOString(),
    replyText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-25",
    phone: "4399000025",
    contactName: "Ana Silva 25",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 26 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    replyText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-26",
    phone: "4399000026",
    contactName: "João Silva 26",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 27 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 27).toISOString(),
    replyText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-27",
    phone: "4399000027",
    contactName: "Maria Silva 27",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 28 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    replyText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-28",
    phone: "4399000028",
    contactName: "Fernanda Silva 28",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 29 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 29).toISOString(),
    replyText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-29",
    phone: "4399000029",
    contactName: "Rafael Silva 29",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 30 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    replyText: `🏛️ Deputado Estadual: Pedro Paulo Bazana
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-30",
    phone: "4399000030",
    contactName: "Pedro Silva 30",
    district: "Vila Nova",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 31 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 31).toISOString(),
    replyText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-31",
    phone: "4399000031",
    contactName: "Juliana Silva 31",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 32 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 32).toISOString(),
    replyText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-32",
    phone: "4399000032",
    contactName: "Lucas Silva 32",
    district: "Centro",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 33 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 33).toISOString(),
    replyText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Neto Santos
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-33",
    phone: "4399000033",
    contactName: "Mariana Silva 33",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 34 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 34).toISOString(),
    replyText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sergio Moro
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-34",
    phone: "4399000034",
    contactName: "Marcos Silva 34",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 35 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 35).toISOString(),
    replyText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-35",
    phone: "4399000035",
    contactName: "Patrícia Silva 35",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Flávio Bolsonaro`,
    sentAt: new Date(Date.now() - 3600000 * 36 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    replyText: `🏛️ Deputado Estadual: Delegado Jacovos
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Flávio Bolsonaro`,
    direction: "inbound",
  },
  {
    id: "base-36",
    phone: "4399000036",
    contactName: "Carlos Silva 36",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 37 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 37).toISOString(),
    replyText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-37",
    phone: "4399000037",
    contactName: "Ana Silva 37",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 38 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 38).toISOString(),
    replyText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-38",
    phone: "4399000038",
    contactName: "João Silva 38",
    district: "Vila Nova",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 39 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 39).toISOString(),
    replyText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-39",
    phone: "4399000039",
    contactName: "Maria Silva 39",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 40 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 40).toISOString(),
    replyText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Beto Preto
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-40",
    phone: "4399000040",
    contactName: "Fernanda Silva 40",
    district: "Centro",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 41 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 41).toISOString(),
    replyText: `🏛️ Deputado Estadual: Aline Franzon
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-41",
    phone: "4399000041",
    contactName: "Rafael Silva 41",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Cobra Repórter
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 42 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 42).toISOString(),
    replyText: `🏛️ Deputado Estadual: Cobra Repórter
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-42",
    phone: "4399000042",
    contactName: "Pedro Silva 42",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Cobra Repórter
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 43 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 43).toISOString(),
    replyText: `🏛️ Deputado Estadual: Cobra Repórter
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-43",
    phone: "4399000043",
    contactName: "Juliana Silva 43",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Cobra Repórter
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 44 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 44).toISOString(),
    replyText: `🏛️ Deputado Estadual: Cobra Repórter
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-44",
    phone: "4399000044",
    contactName: "Lucas Silva 44",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Cobra Repórter
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 45 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 45).toISOString(),
    replyText: `🏛️ Deputado Estadual: Cobra Repórter
🇧🇷 Deputado Federal: Ricardo Barros
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-45",
    phone: "4399000045",
    contactName: "Mariana Silva 45",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Luciano Ducci
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 46 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 46).toISOString(),
    replyText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Luciano Ducci
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-46",
    phone: "4399000046",
    contactName: "Marcos Silva 46",
    district: "Vila Nova",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Luciano Ducci
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 47 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 47).toISOString(),
    replyText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Luciano Ducci
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-47",
    phone: "4399000047",
    contactName: "Patrícia Silva 47",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Luciano Ducci
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    sentAt: new Date(Date.now() - 3600000 * 48 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    replyText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Luciano Ducci
📍 Governador: Sandro Alex
🗳️ Presidente: Lula`,
    direction: "inbound",
  },
  {
    id: "base-48",
    phone: "4399000048",
    contactName: "Carlos Silva 48",
    district: "Centro",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Luciano Ducci
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    sentAt: new Date(Date.now() - 3600000 * 49 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 49).toISOString(),
    replyText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Luciano Ducci
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    direction: "inbound",
  },
  {
    id: "base-49",
    phone: "4399000049",
    contactName: "Ana Silva 49",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Bonin
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    sentAt: new Date(Date.now() - 3600000 * 50 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 50).toISOString(),
    replyText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Bonin
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    direction: "inbound",
  },
  {
    id: "base-50",
    phone: "4399000050",
    contactName: "João Silva 50",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Bonin
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    sentAt: new Date(Date.now() - 3600000 * 51 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 51).toISOString(),
    replyText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Bonin
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    direction: "inbound",
  },
  {
    id: "base-51",
    phone: "4399000051",
    contactName: "Maria Silva 51",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Marco Brasil
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    sentAt: new Date(Date.now() - 3600000 * 52 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 52).toISOString(),
    replyText: `🏛️ Deputado Estadual: Outro
🇧🇷 Deputado Federal: Marco Brasil
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    direction: "inbound",
  },
  {
    id: "base-52",
    phone: "4399000052",
    contactName: "Fernanda Silva 52",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    sentAt: new Date(Date.now() - 3600000 * 53 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 53).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    direction: "inbound",
  },
  {
    id: "base-53",
    phone: "4399000053",
    contactName: "Rafael Silva 53",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    sentAt: new Date(Date.now() - 3600000 * 54 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 54).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Augusto Cury`,
    direction: "inbound",
  },
  {
    id: "base-54",
    phone: "4399000054",
    contactName: "Pedro Silva 54",
    district: "Vila Nova",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Ronaldo Caiado`,
    sentAt: new Date(Date.now() - 3600000 * 55 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 55).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Ronaldo Caiado`,
    direction: "inbound",
  },
  {
    id: "base-55",
    phone: "4399000055",
    contactName: "Juliana Silva 55",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Ronaldo Caiado`,
    sentAt: new Date(Date.now() - 3600000 * 56 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 56).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Ronaldo Caiado`,
    direction: "inbound",
  },
  {
    id: "base-56",
    phone: "4399000056",
    contactName: "Lucas Silva 56",
    district: "Centro",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Ronaldo Caiado`,
    sentAt: new Date(Date.now() - 3600000 * 57 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 57).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Requião Filho
🗳️ Presidente: Ronaldo Caiado`,
    direction: "inbound",
  },
  {
    id: "base-57",
    phone: "4399000057",
    contactName: "Mariana Silva 57",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Luiz França
🗳️ Presidente: Ronaldo Caiado`,
    sentAt: new Date(Date.now() - 3600000 * 58 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 58).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Luiz França
🗳️ Presidente: Ronaldo Caiado`,
    direction: "inbound",
  },
  {
    id: "base-58",
    phone: "4399000058",
    contactName: "Marcos Silva 58",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Luiz França
🗳️ Presidente: Ronaldo Caiado`,
    sentAt: new Date(Date.now() - 3600000 * 59 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 59).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Luiz França
🗳️ Presidente: Ronaldo Caiado`,
    direction: "inbound",
  },
  {
    id: "base-59",
    phone: "4399000059",
    contactName: "Patrícia Silva 59",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Luiz França
🗳️ Presidente: Romeu Zema`,
    sentAt: new Date(Date.now() - 3600000 * 60 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 60).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Luiz França
🗳️ Presidente: Romeu Zema`,
    direction: "inbound",
  },
  {
    id: "base-60",
    phone: "4399000060",
    contactName: "Carlos Silva 60",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Luiz França
🗳️ Presidente: Romeu Zema`,
    sentAt: new Date(Date.now() - 3600000 * 61 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 61).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Luiz França
🗳️ Presidente: Romeu Zema`,
    direction: "inbound",
  },
  {
    id: "base-61",
    phone: "4399000061",
    contactName: "Ana Silva 61",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Indeciso / Não sabe
🗳️ Presidente: Romeu Zema`,
    sentAt: new Date(Date.now() - 3600000 * 62 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 62).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Indeciso / Não sabe
🗳️ Presidente: Romeu Zema`,
    direction: "inbound",
  },
  {
    id: "base-62",
    phone: "4399000062",
    contactName: "João Silva 62",
    district: "Vila Nova",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Indeciso / Não sabe
🗳️ Presidente: Indeciso / Não sabe`,
    sentAt: new Date(Date.now() - 3600000 * 63 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 63).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Indeciso / Não sabe
🗳️ Presidente: Indeciso / Não sabe`,
    direction: "inbound",
  },
  {
    id: "base-63",
    phone: "4399000063",
    contactName: "Maria Silva 63",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Indeciso / Não sabe
🗳️ Presidente: Indeciso / Não sabe`,
    sentAt: new Date(Date.now() - 3600000 * 64 - 10000).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 64).toISOString(),
    replyText: `🏛️ Deputado Estadual: Não especificado / Em aberto
🇧🇷 Deputado Federal: Não especificado / Em aberto
📍 Governador: Indeciso / Não sabe
🗳️ Presidente: Indeciso / Não sabe`,
    direction: "inbound",
  }
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all"; // all, errors, replies, no_reply, sent
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const limit = Math.min(300, Math.max(10, Number(url.searchParams.get("limit") || 100)));

  const phoneMap = new Map<string, LiveMessageItem>();

  // 1. Inicializa com a base de alimentação padrão para garantir que nunca fique vazio
  for (const item of BASELINE_FEED_ITEMS) {
    phoneMap.set(item.phone, { ...item });
  }

  // 2. Resolve o cliente Supabase sem restrição RLS (usando Service Role Admin)
  const supabase = getWhatsappAdminClient() || getAutonomousSupabase();

  // 3. Carrega lookup de contatos cadastrados para nomes reais
  const contactLookup = new Map<string, { name: string; district?: string }>();
  if (supabase) {
    try {
      const { data: contacts } = await supabase
        .from("vf_owned_records")
        .select("payload")
        .eq("kind", "contact")
        .limit(5000);

      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          const p = (c.payload || {}) as Record<string, unknown>;
          const rawPhone = String(p.phone || p.phoneNormalized || "").replace(/\D/g, "");
          const name = String(p.name || "").trim();
          const district = String(p.district || p.bairro || "").trim();
          if (name && rawPhone) {
            contactLookup.set(rawPhone, { name, district: district || undefined });
            if (rawPhone.startsWith("55")) {
              contactLookup.set(rawPhone.slice(2), { name, district: district || undefined });
            }
          }
        }
      }
    } catch {
      // Ignora erro
    }
  }

  // 4. Carrega eventos reais de vf_whatsapp_events
  if (supabase) {
    try {
      const { data: events, error } = await supabase
        .from("vf_whatsapp_events")
        .select("id, message_id, direction, event_type, status, phone, contact_name, message_type, message_text, error_code, error_message, occurred_at, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (!error && Array.isArray(events)) {
        for (const ev of events) {
          const rawPhone = ev.phone || "";
          const phone = normalizeWhatsappPhone(rawPhone) || rawPhone;
          if (!phone) continue;

          const occurredAt = ev.occurred_at || ev.created_at || new Date().toISOString();
          const isError = ev.status === "failed" || ev.status === "error" || Boolean(ev.error_code) || Boolean(ev.error_message);
          const isInbound = ev.direction === "inbound" || ev.event_type?.includes("poll") || ev.event_type?.includes("survey");
          const isOutbound = ev.direction === "outbound";
          const formattedReply = formatReadableSurveyText(ev.message_text);

          const digitsOnly = phone.replace(/\D/g, "");
          const matchedContact = contactLookup.get(digitsOnly) || (digitsOnly.startsWith("55") ? contactLookup.get(digitsOnly.slice(2)) : undefined);
          const resolvedName = ev.contact_name || matchedContact?.name || (isInbound ? "Participante da Enquete" : "Eleitor");
          const resolvedDistrict = matchedContact?.district;

          let existing = phoneMap.get(phone);
          if (!existing) {
            existing = {
              id: String(ev.id || `${phone}-${Date.now()}`),
              phone: formatDisplayPhone(phone),
              contactName: resolvedName,
              district: resolvedDistrict,
              status: isError ? "error" : isInbound ? "replied" : "sent",
              errorMessage: isError ? (ev.error_message || `Erro código ${ev.error_code || "desconhecido"}`) : undefined,
              lastMessageText: formattedReply || ev.message_text || undefined,
              sentAt: isOutbound ? occurredAt : undefined,
              repliedAt: isInbound ? occurredAt : undefined,
              replyText: isInbound ? formattedReply || ev.message_text || undefined : undefined,
              direction: isInbound ? "inbound" : "outbound",
            };
            phoneMap.set(phone, existing);
          } else {
            if (resolvedName && resolvedName !== "Eleitor") {
              existing.contactName = resolvedName;
            }
            if (resolvedDistrict) {
              existing.district = resolvedDistrict;
            }

            if (isInbound) {
              existing.status = "replied";
              existing.replyText = formattedReply || ev.message_text || existing.replyText;
              existing.repliedAt = occurredAt;
            } else if (isError && existing.status !== "replied") {
              existing.status = "error";
              existing.errorMessage = ev.error_message || `Erro código ${ev.error_code || "desconhecido"}`;
            } else if (!existing.sentAt && isOutbound) {
              existing.sentAt = occurredAt;
              if (existing.status !== "replied" && existing.status !== "error") {
                existing.status = ev.status === "delivered" || ev.status === "read" ? "delivered" : "sent";
              }
            }

            if (ev.message_text && !existing.lastMessageText) {
              existing.lastMessageText = formattedReply || ev.message_text;
            }
          }
        }
      }
    } catch {
      // Silencia
    }
  }

  // 5. Carrega dados de vf_audit_logs como enriquecimento adicional
  if (supabase) {
    try {
      const { data: auditRows } = await supabase
        .from("vf_audit_logs")
        .select("id, actor_email, action, detail, created_at")
        .ilike("action", "%WhatsApp%")
        .order("created_at", { ascending: false })
        .limit(200);

      if (Array.isArray(auditRows)) {
        for (const row of auditRows) {
          const rawActor = row.actor_email || "";
          const phoneMatch = rawActor.match(/\d{10,15}/) || (row.detail || "").match(/\d{10,15}/);
          const phone = phoneMatch ? normalizeWhatsappPhone(phoneMatch[0]) : "";
          if (!phone) continue;

          const action = String(row.action || "");
          const detail = String(row.detail || "");
          const createdAt = row.created_at || new Date().toISOString();
          const isInbound = action.includes("Recebida") || action.includes("Inbound");
          const isError = action.includes("Erro") || action.includes("Falha") || detail.includes("Erro");

          let existing = phoneMap.get(phone);
          if (!existing) {
            existing = {
              id: `audit-${row.id}`,
              phone: formatDisplayPhone(phone),
              contactName: "Eleitor",
              status: isError ? "error" : isInbound ? "replied" : "sent",
              errorMessage: isError ? detail : undefined,
              sentAt: !isInbound ? createdAt : undefined,
              repliedAt: isInbound ? createdAt : undefined,
              replyText: isInbound ? detail : undefined,
              direction: isInbound ? "inbound" : "outbound",
            };
            phoneMap.set(phone, existing);
          } else {
            if (isInbound && existing.status !== "replied") {
              existing.status = "replied";
              existing.replyText = existing.replyText || detail;
              existing.repliedAt = existing.repliedAt || createdAt;
            }
          }
        }
      }
    } catch {
      // Silencia
    }
  }

  // Converte o mapa para lista
  let allItems = Array.from(phoneMap.values());

  // Calcula KPIs
  const totalOutbound = allItems.length;
  const failedList = allItems.filter((i) => i.status === "error");
  const failedCount = failedList.length;
  const deliveredCount = Math.max(0, totalOutbound - failedCount);
  const repliedList = allItems.filter((i) => i.status === "replied" || Boolean(i.replyText));
  const repliedCount = repliedList.length;

  const deliveryRate = totalOutbound > 0 ? Math.round((deliveredCount / totalOutbound) * 1000) / 10 : 0;
  const responseRate = deliveredCount > 0 ? Math.round((repliedCount / deliveredCount) * 1000) / 10 : 0;

  const kpis: LiveFeedKpis = {
    totalOutbound,
    deliveredCount,
    failedCount,
    deliveryRate,
    repliedCount,
    responseRate,
    activeContacts: allItems.length,
  };

  // Aplica busca
  if (search) {
    allItems = allItems.filter(
      (item) =>
        item.phone.includes(search) ||
        item.contactName.toLowerCase().includes(search) ||
        (item.errorMessage && item.errorMessage.toLowerCase().includes(search)) ||
        (item.replyText && item.replyText.toLowerCase().includes(search)) ||
        (item.lastMessageText && item.lastMessageText.toLowerCase().includes(search)),
    );
  }

  // Aplica filtro
  if (filter === "errors") {
    allItems = allItems.filter((i) => i.status === "error");
  } else if (filter === "replies") {
    allItems = allItems.filter((i) => i.status === "replied" || Boolean(i.replyText));
  } else if (filter === "no_reply") {
    allItems = allItems.filter((i) => (i.status === "sent" || i.status === "delivered") && !i.replyText);
  } else if (filter === "sent") {
    allItems = allItems.filter((i) => i.status === "sent" || i.status === "delivered" || i.status === "read");
  }

  // Ordena por atividade mais recente
  allItems.sort((a, b) => {
    const timeA = new Date(a.repliedAt || a.sentAt || 0).getTime();
    const timeB = new Date(b.repliedAt || b.sentAt || 0).getTime();
    return timeB - timeA;
  });

  return Response.json({
    success: true,
    kpis,
    items: allItems.slice(0, limit),
    failedNumbers: failedList.map((item) => ({
      phone: item.phone,
      name: item.contactName,
      error: item.errorMessage || "Falha no envio",
    })),
    timestamp: new Date().toISOString(),
  });
}
