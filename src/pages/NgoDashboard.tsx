import { Link } from "react-router-dom";
import { BookOpen, Users, BarChart3, Zap, PlusCircle, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dashboardStats, mockStories } from "@/data/mockData";
import { getDashboardStats, getStories } from "@/lib/api";

const NgoDashboard = () => {
  // ✅ REFACTORED: ngoId extracted from JWT token by backend

  const storiesQuery = useQuery({
    queryKey: ["stories", "ngo-dashboard"],
    queryFn: () => getStories(),
  });

  // ✅ getDashboardStats no longer needs ngoId parameter
  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  const stats = statsQuery.data ?? dashboardStats;
  const stories = storiesQuery.data?.length ? storiesQuery.data : mockStories;
  const statCards = [
    { label: "Stories Created", value: stats.storiesCreated, icon: BookOpen, gradient: "from-primary to-primary/70" },
    { label: "Students Reached", value: stats.studentsReached.toLocaleString(), icon: Users, gradient: "from-secondary to-secondary/70" },
    { label: "Completion Rate", value: `${stats.completionRate}%`, icon: BarChart3, gradient: "from-success to-success/70" },
    { label: "Active Sessions", value: stats.activeSessions, icon: Zap, gradient: "from-accent to-accent/70" },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Welcome back! Here's your story impact overview.</p>
        </div>
        <Button className="gap-2 font-bold shadow-glow" asChild>
          <Link to="/ngo/create-story"><PlusCircle className="h-4 w-4" /> Create Story</Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="group relative overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1">
            <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${stat.gradient}`} />
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.gradient}`}>
                <stat.icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="font-display text-3xl font-black text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Stories Table */}
      <Card className="border-0 shadow-card">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="font-display text-xl font-bold">Recent Stories</CardTitle>
          <Button variant="ghost" size="sm" className="font-semibold text-primary" asChild>
            <Link to="/ngo/my-stories">View All →</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="font-bold">Title</TableHead>
                <TableHead className="font-bold">Topic</TableHead>
                <TableHead className="font-bold">Age Group</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold">Students</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stories.map((story) => (
                <TableRow key={story.id} className="border-border/30 transition-colors hover:bg-muted/50">
                  <TableCell className="font-display font-bold">{story.title}</TableCell>
                  <TableCell>{story.topic}</TableCell>
                  <TableCell>{story.ageGroup}</TableCell>
                  <TableCell>
                    <Badge variant={story.status === "published" ? "default" : "secondary"} className="font-bold">
                      {story.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{story.studentsReached}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="gap-1 font-semibold text-primary" asChild>
                      <Link to={`/ngo/story-preview?storyId=${story.id}`}><Eye className="h-3.5 w-3.5" /> View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default NgoDashboard;
