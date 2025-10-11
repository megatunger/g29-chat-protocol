"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  MapPin,
  Phone,
  ReceiptText,
  StickyNote,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

type Booking = {
  id: string;
  serviceName: string;
  providerName: string;
  providerPhone?: string;
  scheduledFor: string;
  durationMinutes: number;
  price: number;
  currency: string;
  status: BookingStatus;
  locationLine1: string;
  locationLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const demoBookings: Booking[] = [
  {
    id: "BK-49011",
    serviceName: "Window Repair Assessment",
    providerName: "Brightview Window Co.",
    providerPhone: "+1 (262) 555-4470",
    scheduledFor: "2025-02-12T16:30:00.000Z",
    durationMinutes: 75,
    price: 135,
    currency: "USD",
    status: "pending",
    locationLine1: "412 Parkside Terrace",
    city: "Whitefish Bay",
    state: "WI",
    postalCode: "53217",
    notes: "Awaiting temporary building access pass from concierge.",
    createdAt: "2025-01-04T12:12:00.000Z",
    updatedAt: "2025-01-10T08:02:00.000Z",
  },
  {
    id: "BK-48392",
    serviceName: "Premium Home Cleaning",
    providerName: "Sparkle & Co.",
    providerPhone: "+1 (414) 555-9072",
    scheduledFor: "2025-01-22T14:00:00.000Z",
    durationMinutes: 120,
    price: 189,
    currency: "USD",
    status: "confirmed",
    locationLine1: "1250 Riverside Avenue",
    locationLine2: "Suite 304",
    city: "Milwaukee",
    state: "WI",
    postalCode: "53202",
    notes: "Client prefers eco-friendly products only.",
    createdAt: "2025-01-06T18:43:00.000Z",
    updatedAt: "2025-01-08T11:15:00.000Z",
  },
  {
    id: "BK-48271",
    serviceName: "HVAC Seasonal Tune-Up",
    providerName: "Northshore Climate Pros",
    providerPhone: "+1 (414) 555-6104",
    scheduledFor: "2024-12-15T15:30:00.000Z",
    durationMinutes: 90,
    price: 249,
    currency: "USD",
    status: "completed",
    locationLine1: "8700 W Heather Lane",
    city: "Brookfield",
    state: "WI",
    postalCode: "53005",
    notes: "Technician replaced air filter and calibrated thermostat.",
    createdAt: "2024-11-28T09:05:00.000Z",
    updatedAt: "2024-12-16T17:25:00.000Z",
  },
  {
    id: "BK-47889",
    serviceName: "Landscaping Consultation",
    providerName: "Lakefront Greens",
    providerPhone: "+1 (262) 555-2038",
    scheduledFor: "2024-11-02T18:00:00.000Z",
    durationMinutes: 60,
    price: 95,
    currency: "USD",
    status: "cancelled",
    locationLine1: "529 Oak Grove Drive",
    city: "Wauwatosa",
    state: "WI",
    postalCode: "53213",
    notes: "Client cancelled due to travel conflict.",
    createdAt: "2024-10-15T14:20:00.000Z",
    updatedAt: "2024-10-29T08:42:00.000Z",
  },
];

const statusStyles: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  confirmed: "bg-blue-100 text-blue-900 border-blue-200",
  completed: "bg-emerald-100 text-emerald-900 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-900 border-rose-200",
};

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const isUpcoming = (booking: Booking) => {
  const now = new Date();
  const scheduled = new Date(booking.scheduledFor);

  return scheduled > now && booking.status !== "cancelled";
};

const BookingHistoryPage = () => {
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["value"]>(
    "all",
  );

  const summary = useMemo(() => {
    const total = demoBookings.length;
    const upcoming = demoBookings.filter((booking) =>
      isUpcoming(booking),
    ).length;
    const completed = demoBookings.filter(
      (booking) => booking.status === "completed",
    ).length;
    const cancelled = demoBookings.filter(
      (booking) => booking.status === "cancelled",
    ).length;
    const pending = demoBookings.filter(
      (booking) => booking.status === "pending",
    ).length;

    return { total, upcoming, completed, cancelled, pending };
  }, []);

  const bookingsToDisplay = useMemo(() => {
    if (filter === "all") {
      return demoBookings;
    }

    if (filter === "upcoming") {
      return demoBookings.filter((booking) => isUpcoming(booking));
    }

    return demoBookings.filter((booking) => booking.status === filter);
  }, [filter]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-900/80">
          Service bookings
        </p>
        <h1 className="text-2xl font-heading sm:text-3xl">
          Booking history
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Review every service appointment you have scheduled, confirm upcoming
          visits, and keep track of completed work.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="rounded-2xl border-blue-200/80 bg-blue-50">
          <CardHeader className="gap-2">
            <CardTitle className="text-base">Total bookings</CardTitle>
            <CardDescription className="text-2xl font-heading">
              {summary.total}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-emerald-200/80 bg-emerald-50">
          <CardHeader className="gap-2">
            <CardTitle className="text-base">Upcoming visits</CardTitle>
            <CardDescription className="text-2xl font-heading">
              {summary.upcoming}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs font-medium text-emerald-900/80">
              {summary.pending} pending confirmation
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 bg-white sm:col-span-1">
          <CardHeader className="gap-2">
            <CardTitle className="text-base">Completed jobs</CardTitle>
            <CardDescription className="text-2xl font-heading">
              {summary.completed}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-rose-200/80 bg-rose-50">
          <CardHeader className="gap-2">
            <CardTitle className="text-base">Cancelled</CardTitle>
            <CardDescription className="text-2xl font-heading">
              {summary.cancelled}
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="flex flex-wrap gap-2">
        {statusFilters.map((statusOption) => {
          const isActive = filter === statusOption.value;

          return (
            <Button
              key={statusOption.value}
              variant={isActive ? "default" : "neutral"}
              size="sm"
              onClick={() => setFilter(statusOption.value)}
              className={
                isActive
                  ? ""
                  : "border-dashed border-border/70 bg-white text-foreground"
              }
            >
              {statusOption.label}
            </Button>
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        {bookingsToDisplay.map((booking) => {
          const scheduledDate = new Date(booking.scheduledFor);

          return (
            <Card key={booking.id} className="rounded-2xl">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">
                      {booking.serviceName}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      Booking ID {booking.id}
                    </CardDescription>
                  </div>
                  <Badge className={statusStyles[booking.status]}>
                    {booking.status.charAt(0).toUpperCase() +
                      booking.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 sm:text-base">
                  <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-secondary-background p-4">
                    <div className="flex items-start gap-2">
                      <CalendarDays className="mt-0.5 size-4" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-foreground/70">
                          Scheduled
                        </p>
                        <p className="font-medium">
                          {dateFormatter.format(scheduledDate)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {timeFormatter.format(scheduledDate)} · {" "}
                          {booking.durationMinutes} minutes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-foreground/70">
                          Location
                        </p>
                        <p className="font-medium leading-snug">
                          {booking.locationLine1}
                          {booking.locationLine2 ? (
                            <>
                              <br />
                              {booking.locationLine2}
                            </>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {booking.city}, {booking.state}
                          {booking.postalCode ? ` ${booking.postalCode}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-secondary-background p-4">
                    <div className="flex items-start gap-2">
                      <ReceiptText className="mt-0.5 size-4" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-foreground/70">
                          Payment
                        </p>
                        <p className="font-medium">
                          {formatCurrency(booking.price, booking.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Charged in {booking.currency}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 size-4" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-foreground/70">
                          Provider
                        </p>
                        <p className="font-medium">{booking.providerName}</p>
                        {booking.providerPhone ? (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="size-3" />
                            {booking.providerPhone}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {booking.notes ? (
                  <div className="flex items-start gap-2 rounded-xl border border-dashed border-border/60 bg-white p-4 text-sm text-foreground/80">
                    <StickyNote className="mt-0.5 size-4 text-foreground/70" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-foreground/70">
                        Notes
                      </p>
                      <p className="leading-relaxed">{booking.notes}</p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
              <CardFooter className="flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    Created {dateFormatter.format(new Date(booking.createdAt))}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span>
                    Last updated {dateFormatter.format(new Date(booking.updatedAt))}
                  </span>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button className="w-full sm:w-auto">View details</Button>
                  <Button
                    variant="neutral"
                    className="w-full border-dashed border-border/70 bg-white text-foreground sm:w-auto"
                  >
                    Contact provider
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </section>
    </div>
  );
};

export default BookingHistoryPage;
