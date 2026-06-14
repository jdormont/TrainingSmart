import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { 
  Newspaper, 
  ExternalLink, 
  AlertTriangle, 
  RefreshCw, 
  Sliders, 
  Zap,
  Loader2
} from "lucide-react";
import { supabase } from "../../services/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import type { CyclingDigestPayload } from "../../types";

const DISCIPLINE_LABELS: Record<string, string> = {
  road: "Road",
  gravel: "Gravel",
  womens: "Women's",
  track: "Track",
  cyclocross: "Cyclocross",
  other: "Other"
};

const DISCIPLINE_COLORS: Record<string, string> = {
  road: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  gravel: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  womens: "bg-pink-500/10 text-pink-400 border border-pink-500/20",
  track: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  cyclocross: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  other: "bg-slate-500/10 text-slate-400 border border-slate-500/20"
};

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Updated just now";
    if (diffMins < 60) return `Updated ${diffMins}m ago`;
    if (diffHours < 24) return `Updated ${diffHours}h ago`;
    return `Updated ${diffDays}d ago`;
  } catch (_e) {
    return "Updated recently";
  }
}

const fetchCyclingDigest = async (): Promise<CyclingDigestPayload> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("User session not found");

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cycling-news-digest`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch news digest");
  }

  return response.json();
};

export const CyclingDigest: React.FC = () => {
  const { userProfile } = useAuth();
  
  const { data, isLoading, error, refetch, isFetching } = useQuery<CyclingDigestPayload>({
    queryKey: ["cycling-digest"],
    queryFn: fetchCyclingDigest,
    staleTime: 1000 * 60 * 30, // 30 minutes cache
    retry: 1
  });

  const activeFilters = userProfile?.cycling_digest_filters ?? ["road", "gravel", "womens", "track", "cyclocross", "other"];

  const headlines = data?.headlines ?? [];
  const filteredHeadlines = headlines.filter(h => activeFilters.includes(h.discipline));

  if (isLoading) {
    return (
      <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
        <h3 className="text-slate-200 font-medium mb-1">Synthesizing Today's news</h3>
        <p className="text-slate-400 text-sm">Aggregating cycling feeds and crafting AI summaries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-6 text-center max-w-2xl mx-auto my-4">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-red-200 font-semibold mb-1">Couldn't load digest</h3>
        <p className="text-slate-400 text-sm mb-4">{(error as Error).message || "Try again later."}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and updated timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-500/10 p-2 rounded-lg">
            <Newspaper className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Today in Cycling</h2>
            {data?.generatedAt && (
              <p className="text-xs text-slate-500 mt-0.5">
                {formatRelativeTime(data.generatedAt)}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Syncing..." : "Refresh"}
        </button>
      </div>

      {/* Active Races updates */}
      {data?.activeRaces && data.activeRaces.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
            <Zap className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
            Races Happening Now
          </h3>
          {data.activeRaces.map((race, idx) => (
            <div 
              key={idx} 
              className="bg-slate-900/40 border border-slate-850/60 rounded-xl p-5 relative overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${DISCIPLINE_COLORS[race.discipline] || DISCIPLINE_COLORS.other}`}>
                  {DISCIPLINE_LABELS[race.discipline] || race.discipline}
                </span>
                <span className="font-bold text-slate-100 text-lg">{race.raceName}</span>
              </div>

              {race.overview && (
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  {race.overview}
                </p>
              )}

              {race.keyUpdates && race.keyUpdates.length > 0 ? (
                <ul className="space-y-2.5 border-l-2 border-slate-800 pl-3.5 mt-2">
                  {race.keyUpdates.map((update, uidx) => (
                    <li key={uidx} className="text-sm leading-relaxed">
                      <span className="font-semibold text-slate-200 block sm:inline mr-1">{update.label}:</span>
                      <span className="text-slate-450 text-slate-400">{update.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm">{race.oneLiner}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Headlines List */}
      {filteredHeadlines.length === 0 ? (
        <div className="text-center py-12 px-6 bg-slate-900/20 border border-slate-800/80 rounded-xl max-w-xl mx-auto">
          <Sliders className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-300 font-semibold mb-1">No headlines match filters</h3>
          <p className="text-slate-450 text-sm mb-5 leading-relaxed">
            No recent news matches your selected disciplines. Update your preferences in Settings.
          </p>
          <Link 
            to="/settings" 
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-650 hover:bg-orange-600 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            Update Preferences
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredHeadlines.map((headline, idx) => (
            <a 
              key={idx}
              href={headline.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between p-5 bg-slate-900/30 hover:bg-slate-900/60 border border-slate-850 hover:border-slate-750 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-md hover:shadow-orange-500/5 relative overflow-hidden"
            >
              <div>
                <div className="flex justify-between items-center gap-4 mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${DISCIPLINE_COLORS[headline.discipline] || DISCIPLINE_COLORS.other}`}>
                    {DISCIPLINE_LABELS[headline.discipline] || headline.discipline}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                </div>
                <h3 className="font-semibold text-slate-200 group-hover:text-orange-400 transition-colors leading-snug mb-2 pr-2 text-base">
                  {headline.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  {headline.summary}
                </p>
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Click to read original article
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
