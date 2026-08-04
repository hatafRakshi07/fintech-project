import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, MapPin, Gift, PhoneCall, PlusCircle, Sparkles } from "lucide-react";

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    type: "DRAW",
    date: new Date().toISOString().split("T")[0],
    description: "",
    committeeId: "",
  });

  const { data: response, isLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["calendar", "events", dateRange],
    queryFn: () => {
      let query = "";
      if (dateRange.start) query += `?startDate=${dateRange.start}`;
      if (dateRange.end) query += `${query ? '&' : '?'}endDate=${dateRange.end}`;
      return customFetch(`/v2/calendar/events${query}`);
    }
  });

  const addEventMutation = useMutation({
    mutationFn: (data: typeof newEvent) =>
      customFetch("/v2/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar", "events"] });
      setIsAddModalOpen(false);
      setNewEvent({
        title: "",
        type: "DRAW",
        date: new Date().toISOString().split("T")[0],
        description: "",
        committeeId: "",
      });
    },
  });

  const events = response?.data || [];

  // Group events by date (YYYY-MM-DD)
  const groupedEvents = events.reduce((acc, event) => {
    const dateStr = event.date ? new Date(event.date).toISOString().split('T')[0] : 'Other';
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2 text-white">
            <CalendarIcon className="text-purple-400 h-7 w-7" />
            Operational Monthly Calendar
          </h1>
          <p className="text-xs text-purple-200/80 mt-1">
            Automated schedule of 4 Bissi Scheme Draws (5th, 15th, 20th) & Collection Promises.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 font-bold shadow-md"
          >
            <PlusCircle className="w-4 h-4" />
            Add Event / Draw
          </Button>

          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/20">
            <input 
              type="date" 
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            <span className="text-xs text-purple-300 font-bold">to</span>
            <input 
              type="date" 
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Loading Monthly Operational Calendar...</p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border rounded-2xl bg-muted/20">
          No draws or promises scheduled for this period.
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map(dateStr => (
            <div key={dateStr} className="relative pl-6 border-l-2 border-purple-300 dark:border-purple-800">
              <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-purple-600 border-4 border-background shadow-xs" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {dateStr === new Date().toISOString().split('T')[0] && (
                  <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 border border-rose-200 text-xs font-bold">
                    Today
                  </Badge>
                )}
              </h2>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groupedEvents[dateStr].map((event: any) => (
                  <Card key={event.id} className={`overflow-hidden shadow-xs hover:shadow-md transition-shadow ${event.type === 'DRAW' ? 'border-amber-500/30 bg-amber-500/5' : 'border-blue-500/30 bg-blue-500/5'}`}>
                    <div className={`h-1.5 w-full ${event.type === 'DRAW' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {event.type === 'DRAW' ? (
                            <Gift className="w-5 h-5 text-amber-600" />
                          ) : (
                            <MapPin className="w-5 h-5 text-blue-600" />
                          )}
                          <span className={`text-[11px] font-extrabold uppercase tracking-wider ${event.type === 'DRAW' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                            {event.type === 'DRAW' ? 'Monthly Draw' : 'Promise Visit'}
                          </span>
                        </div>
                      </div>
                      
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">{event.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add New Calendar Event */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Add Monthly Event / Draw Date
            </DialogTitle>
          </DialogHeader>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              addEventMutation.mutate(newEvent);
            }} 
            className="space-y-4 pt-2"
          >
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Event Title *</label>
              <Input 
                placeholder="e.g. Sawariya Seth Draw or Customer Visit" 
                value={newEvent.title}
                onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Event Type</label>
                <select
                  value={newEvent.type}
                  onChange={e => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full h-9 border rounded-md px-2 text-xs bg-background focus:outline-none"
                >
                  <option value="DRAW">Monthly Draw</option>
                  <option value="COLLECTION_REGISTER">Field Visit Promise</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Event Date *</label>
                <Input 
                  type="date"
                  value={newEvent.date}
                  onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Description / Notes</label>
              <Input 
                placeholder="Optional details..." 
                value={newEvent.description}
                onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={addEventMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold">
                {addEventMutation.isPending ? "Adding..." : "Save Event"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
