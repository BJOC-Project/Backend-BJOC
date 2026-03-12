import { supabase } from "../../config/supabase";

export const stopsService = {

    async getStopsByRoute(routeId: string) {

    const { data: route, error: routeError } = await supabase
        .from("routes")
        .select("published_version")
        .eq("id", routeId)
        .single();

    if (routeError) throw routeError;

    const draftVersion = route.published_version + 1;

    // Check if a draft exists
    const { data: draftStops } = await supabase
        .from("stops")
        .select("*")
        .eq("route_id", routeId)
        .eq("version", draftVersion)
        .order("stop_order", { ascending: true });

    if (draftStops && draftStops.length > 0) {
        return draftStops;
    }

    // Otherwise return published stops
    const { data, error } = await supabase
        .from("stops")
        .select("*")
        .eq("route_id", routeId)
        .eq("version", route.published_version)
        .order("stop_order", { ascending: true });

    if (error) throw error;

    return data;
},

    async updateStop(id: string, payload: {
        stop_name?: string;
        latitude?: number;
        longitude?: number;
    }) {

        const { data: stop, error: stopError } = await supabase
            .from("stops")
            .select("*")
            .eq("id", id)
            .single();

        if (stopError) throw stopError;

        const { data: route, error: routeError } = await supabase
            .from("routes")
            .select("published_version")
            .eq("id", stop.route_id)
            .single();

        if (routeError) throw routeError;

        const draftVersion = route.published_version + 1;

        if (stop.version === draftVersion) {

            const { data, error } = await supabase
                .from("stops")
                .update(payload)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;

            return data;

        } else {

            const { data, error } = await supabase
                .from("stops")
                .insert({
                    route_id: stop.route_id,
                    stop_name: payload.stop_name ?? stop.stop_name,
                    latitude: payload.latitude ?? stop.latitude,
                    longitude: payload.longitude ?? stop.longitude,
                    stop_order: stop.stop_order,
                    version: draftVersion,
                    is_active: stop.is_active
                })
                .select()
                .single();

            if (error) throw error;

            return data;
        }
    },

    async createStop(payload: {
        route_id: string;
        stop_name: string;
        latitude: number;
        longitude: number;
    }) {

        const { route_id } = payload;

        const { data: route, error: routeError } = await supabase
            .from("routes")
            .select("published_version")
            .eq("id", route_id)
            .single();

        if (routeError) throw routeError;

        const draftVersion = route.published_version + 1;

        const { data: lastStop } = await supabase
            .from("stops")
            .select("stop_order")
            .eq("route_id", route_id)
            .eq("version", draftVersion)
            .order("stop_order", { ascending: false })
            .limit(1)
            .maybeSingle();

        const newOrder = lastStop ? lastStop.stop_order + 1 : 1;

        const { data, error } = await supabase
            .from("stops")
            .insert({
                ...payload,
                stop_order: newOrder,
                version: draftVersion,
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    },

    async deleteStop(id: string) {

        const { error } = await supabase
            .from("stops")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return { success: true };
    },

    async toggleStopStatus(id: string, is_active: boolean) {

        const { data, error } = await supabase
            .from("stops")
            .update({ is_active })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return data;
    },

    async updateStopOrder(stops: { id: string; stop_order: number }[]) {

        const updates = stops.map((stop) =>
            supabase
                .from("stops")
                .update({ stop_order: stop.stop_order })
                .eq("id", stop.id)
        );

        const results = await Promise.all(updates);

        const error = results.find(r => r.error);

        if (error) throw error.error;

        return { success: true };
    }

};