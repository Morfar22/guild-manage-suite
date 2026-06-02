import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Bot, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center animate-fade-in">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl gradient-blurple shadow-glow">
          <Bot className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="mb-2 text-6xl font-bold text-foreground">{t('notFound.title')}</h1>
        <p className="mb-6 text-xl text-muted-foreground">{t('notFound.subtitle')}</p>
        <p className="mb-8 text-sm text-muted-foreground max-w-md mx-auto">
          {t('notFound.description')}
        </p>
        <Button asChild className="gradient-blurple text-primary-foreground hover:opacity-90">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('notFound.backHome')}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
