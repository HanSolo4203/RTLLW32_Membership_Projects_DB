"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type {
  Attendance,
  CharityEvent,
  Guest,
  Member,
  Meeting,
  Pipeliner,
  Tables,
} from "@/types/database";

type SettingsValues = {
  goodThreshold: number;
  warningThreshold: number;
  emailNotifications: boolean;
  defaultLocation: string;
};

type DataStats = Record<
  "members" | "meetings" | "attendance" | "guests" | "pipeliners" | "charity_events",
  number
>;

type BackupPayload = {
  members: Member[];
  meetings: Meeting[];
  attendance: Attendance[];
  guests: Guest[];
  pipeliners: Pipeliner[];
  charity_events: CharityEvent[];
};

type UseSettingsState = {
  values: SettingsValues;
  loading: boolean;
  saving: boolean;
  error: string | null;
  stats: DataStats | null;
  statsLoading: boolean;
  actionInFlight: boolean;
};

const DEFAULT_SETTINGS: SettingsValues = {
  goodThreshold: 80,
  warningThreshold: 60,
  emailNotifications: true,
  defaultLocation: "",
};

const TABLES = [
  { name: "attendance", conflict: "id" },
  { name: "charity_events", conflict: "id" },
  { name: "pipeliners", conflict: "id" },
  { name: "guests", conflict: "id" },
  { name: "meetings", conflict: "id" },
  { name: "members", conflict: "id" },
] as const;

const SETTINGS_KEYS = {
  goodThreshold: "attendance_good_threshold",
  warningThreshold: "attendance_warning_threshold",
  emailNotifications: "notifications_email_enabled",
  defaultLocation: "default_meeting_location",
} as const;

export const CLEAR_DATA_PASSWORD = "RTL32-RESET";

const initialState: UseSettingsState = {
  values: DEFAULT_SETTINGS,
  loading: true,
  saving: false,
  error: null,
  stats: null,
  statsLoading: true,
  actionInFlight: false,
};

export function useSettings() {
  const [state, setState] = useState<UseSettingsState>(initialState);

  const setPartialState = useCallback((partial: Partial<UseSettingsState>) => {
    setState((previous) => ({ ...previous, ...partial }));
  }, []);

  const fetchSettings = useCallback(async () => {
    setPartialState({ loading: true, error: null });
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value, text_value")
        .in("key", Object.values(SETTINGS_KEYS));

      if (error) throw error;

      const map = new Map<string, { value: number | null; text_value: string | null }>();
      (data ?? []).forEach((row) =>
        map.set(row.key, { value: row.value ?? null, text_value: row.text_value ?? null }),
      );

      const values: SettingsValues = {
        goodThreshold:
          map.get(SETTINGS_KEYS.goodThreshold)?.value ?? DEFAULT_SETTINGS.goodThreshold,
        warningThreshold:
          map.get(SETTINGS_KEYS.warningThreshold)?.value ?? DEFAULT_SETTINGS.warningThreshold,
        emailNotifications:
          (map.get(SETTINGS_KEYS.emailNotifications)?.value ?? 1) >= 1
            ? true
            : DEFAULT_SETTINGS.emailNotifications,
        defaultLocation:
          map.get(SETTINGS_KEYS.defaultLocation)?.text_value ??
          DEFAULT_SETTINGS.defaultLocation,
      };

      setPartialState({ values, loading: false });
    } catch (error) {
      console.error("Failed to load settings", error);
      setPartialState({
        loading: false,
        error:
          error instanceof Error ? error.message : "Unable to load settings right now.",
      });
    }
  }, [setPartialState]);

  const fetchStats = useCallback(async () => {
    setPartialState({ statsLoading: true });
    try {
      const supabase = getSupabaseBrowserClient();
      const statsEntries = await Promise.all(
        TABLES.map(async (table) => {
          const { count, error } = await supabase
            .from(table.name)
            .select("*", { head: true, count: "exact" });
          if (error) throw error;
          return [table.name, count ?? 0] as const;
        }),
      );
      const stats = statsEntries.reduce<DataStats>(
        (acc, [name, count]) => ({ ...acc, [name]: count }),
        {
          members: 0,
          meetings: 0,
          attendance: 0,
          guests: 0,
          pipeliners: 0,
          charity_events: 0,
        },
      );
      setPartialState({ stats, statsLoading: false });
    } catch (error) {
      console.error("Failed to load statistics", error);
      setPartialState({
        statsLoading: false,
        error:
          error instanceof Error ? error.message : "Unable to load database statistics.",
      });
    }
  }, [setPartialState]);

  useEffect(() => {
    void fetchSettings();
    void fetchStats();
  }, [fetchSettings, fetchStats]);

  const saveSettings = useCallback(
    async (values: SettingsValues) => {
      setPartialState({ saving: true, error: null });
      try {
        const supabase = getSupabaseBrowserClient();
        const payload = [
          { key: SETTINGS_KEYS.goodThreshold, value: values.goodThreshold },
          { key: SETTINGS_KEYS.warningThreshold, value: values.warningThreshold },
          {
            key: SETTINGS_KEYS.emailNotifications,
            value: values.emailNotifications ? 1 : 0,
          },
          {
            key: SETTINGS_KEYS.defaultLocation,
            text_value: values.defaultLocation,
          },
        ];

        const { error } = await supabase
          .from("app_settings")
          .upsert(payload, { onConflict: "key" });

        if (error) throw error;

        setPartialState({ values, saving: false });
      } catch (error) {
        console.error("Failed to save settings", error);
        setPartialState({
          saving: false,
          error:
            error instanceof Error ? error.message : "Unable to save settings right now.",
        });
        throw error;
      }
    },
    [setPartialState],
  );

  const downloadJsonFile = useCallback((data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const backupAllData = useCallback(async () => {
    setPartialState({ actionInFlight: true, error: null });
    try {
      const supabase = getSupabaseBrowserClient();
      const payload: BackupPayload = {
        members: [],
        meetings: [],
        attendance: [],
        guests: [],
        pipeliners: [],
        charity_events: [],
      };

      const [
        membersResult,
        meetingsResult,
        attendanceResult,
        guestsResult,
        pipelinersResult,
        charityEventsResult,
      ] =
        await Promise.all([
          supabase.from("members").select("*"),
          supabase.from("meetings").select("*"),
          supabase.from("attendance").select("*"),
          supabase.from("guests").select("*"),
          supabase.from("pipeliners").select("*"),
          supabase.from("charity_events").select("*"),
        ]);

      if (membersResult.error) throw membersResult.error;
      if (meetingsResult.error) throw meetingsResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (guestsResult.error) throw guestsResult.error;
      if (pipelinersResult.error) throw pipelinersResult.error;
      if (charityEventsResult.error) throw charityEventsResult.error;

      payload.members = (membersResult.data ?? []) as Member[];
      payload.meetings = (meetingsResult.data ?? []) as Meeting[];
      payload.attendance = (attendanceResult.data ?? []) as Attendance[];
      payload.guests = (guestsResult.data ?? []) as Guest[];
      payload.pipeliners = (pipelinersResult.data ?? []) as Pipeliner[];
      payload.charity_events = (charityEventsResult.data ?? []) as CharityEvent[];

      const filename = `RTL32_Backup_${format(new Date(), "yyyy-MM-dd")}.json`;
      downloadJsonFile(payload, filename);
      setPartialState({ actionInFlight: false });
      return payload;
    } catch (error) {
      console.error("Failed to backup data", error);
      setPartialState({
        actionInFlight: false,
        error:
          error instanceof Error ? error.message : "Unable to backup data right now.",
      });
      throw error;
    }
  }, [downloadJsonFile, setPartialState]);

  const importFromBackup = useCallback(
    async (payload: Partial<BackupPayload>) => {
      setPartialState({ actionInFlight: true, error: null });
      try {
        const supabase = getSupabaseBrowserClient();

        if (payload.members?.length) {
          const { error } = await supabase
            .from("members")
            .upsert(
              payload.members as Tables["members"]["Insert"][],
              { onConflict: "id" },
            );
          if (error) throw error;
        }

        if (payload.meetings?.length) {
          const { error } = await supabase
            .from("meetings")
            .upsert(
              payload.meetings as Tables["meetings"]["Insert"][],
              { onConflict: "id" },
            );
          if (error) throw error;
        }

        if (payload.guests?.length) {
          const { error } = await supabase
            .from("guests")
            .upsert(
              payload.guests as Tables["guests"]["Insert"][],
              { onConflict: "id" },
            );
          if (error) throw error;
        }

        if (payload.pipeliners?.length) {
          const { error } = await supabase
            .from("pipeliners")
            .upsert(
              payload.pipeliners as Tables["pipeliners"]["Insert"][],
              { onConflict: "id" },
            );
          if (error) throw error;
        }

        if (payload.charity_events?.length) {
          const { error } = await supabase
            .from("charity_events")
            .upsert(
              payload.charity_events as Tables["charity_events"]["Insert"][],
              { onConflict: "id" },
            );
          if (error) throw error;
        }

        if (payload.attendance?.length) {
          const { error } = await supabase
            .from("attendance")
            .upsert(
              payload.attendance as Tables["attendance"]["Insert"][],
              { onConflict: "id" },
            );
          if (error) throw error;
        }

        setPartialState({ actionInFlight: false });
        await fetchStats();
      } catch (error) {
        console.error("Failed to import data", error);
        setPartialState({
          actionInFlight: false,
          error:
            error instanceof Error ? error.message : "Unable to import backup data.",
        });
        throw error;
      }
    },
    [fetchStats, setPartialState],
  );

  const clearAllData = useCallback(
    async (password: string) => {
      if (password !== CLEAR_DATA_PASSWORD) {
        throw new Error("Incorrect confirmation password.");
      }
      setPartialState({ actionInFlight: true, error: null });
      try {
        const supabase = getSupabaseBrowserClient();
        for (const table of TABLES) {
          const { error } = await supabase.from(table.name).delete().neq("id", "");
          if (error) throw error;
        }
        setPartialState({ actionInFlight: false });
        await fetchStats();
      } catch (error) {
        console.error("Failed to clear data", error);
        setPartialState({
          actionInFlight: false,
          error:
            error instanceof Error ? error.message : "Unable to clear data at the moment.",
        });
        throw error;
      }
    },
    [fetchStats, setPartialState],
  );

  const refresh = useCallback(async () => {
    await Promise.all([fetchSettings(), fetchStats()]);
  }, [fetchSettings, fetchStats]);

  return useMemo(
    () => ({
      values: state.values,
      loading: state.loading,
      saving: state.saving,
      error: state.error,
      stats: state.stats,
      statsLoading: state.statsLoading,
      actionInFlight: state.actionInFlight,
      saveSettings,
      backupAllData,
      importFromBackup,
      clearAllData,
      refresh,
    }),
    [
      state.values,
      state.loading,
      state.saving,
      state.error,
      state.stats,
      state.statsLoading,
      state.actionInFlight,
      saveSettings,
      backupAllData,
      importFromBackup,
      clearAllData,
      refresh,
    ],
  );
}


