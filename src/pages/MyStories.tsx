import { Link } from "react-router-dom";
import { Eye, Edit3, Copy, PlusCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockStories } from "@/data/mockData";
import { toast } from "sonner";
import { getStories } from "@/lib/api";

const MyStories = () => {
  const storiesQuery = useQuery({
    queryKey: ["stories", "ngo-list"],
    queryFn: () => getStories(),
  });

  const stories = storiesQuery.data?.length ? storiesQuery.data : mockStories;

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-foreground">My Stories</h1>
          <p className="mt-1 text-muted-foreground">Manage your created stories</p>
        </div>
        <Button className="gap-2 font-bold shadow-glow" asChild>
          <Link to="/ngo/create-story"><PlusCircle className="h-4 w-4" /> New Story</Link>
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stories.map((story) => (
          <Card key={story.id} className="group overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-2">
            <div className="relative overflow-hidden">
              <img src={story.coverImage} alt={story.title} className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <Badge className="absolute right-3 top-3 font-bold" variant={story.status === "published" ? "default" : "secondary"}>
                {story.status}
              </Badge>
            </div>
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-bold text-foreground">{story.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{story.topic} · Ages {story.ageGroup}</p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1 font-semibold" asChild>
                  <Link to={`/ngo/story-preview?storyId=${story.id}`}><Eye className="h-3.5 w-3.5" /> Preview</Link>
                </Button>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => toast.success("Story duplicated!")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyStories;
