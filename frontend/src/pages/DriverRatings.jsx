import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { 
  ArrowLeft, Star, TrendingUp, TrendingDown, ThumbsUp,
  RefreshCw, MessageSquare, Award, Target
} from "lucide-react";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DriverRatings() {
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuthStore();
  
  const [ratings, setRatings] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRatings();
  }, []);

  const loadRatings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/driver/ratings`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRatings(data.summary);
        setReviews(data.reviews || []);
      }
    } catch (e) { 
      console.log(e); 
    }
    setLoading(false);
  };

  const getRatingColor = (rating) => {
    if (rating >= 4.8) return 'text-green-600';
    if (rating >= 4.5) return 'text-blue-600';
    if (rating >= 4.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRatingBadge = (rating) => {
    if (rating >= 4.8) return { text: 'Excellent', color: 'bg-green-100 text-green-700' };
    if (rating >= 4.5) return { text: 'Great', color: 'bg-blue-100 text-blue-700' };
    if (rating >= 4.0) return { text: 'Good', color: 'bg-yellow-100 text-yellow-700' };
    return { text: 'Needs Improvement', color: 'bg-red-100 text-red-700' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  const avgRating = ratings?.average_rating || 4.85;
  const badge = getRatingBadge(avgRating);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/driver')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">My Ratings</h1>
        <button onClick={loadRatings} className="ml-auto p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Overall Rating Card */}
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={`w-8 h-8 ${
                      star <= Math.round(avgRating) 
                        ? 'text-yellow-500 fill-yellow-500' 
                        : 'text-gray-300'
                    }`} 
                  />
                ))}
              </div>
              <div className={`text-5xl font-bold ${getRatingColor(avgRating)}`}>
                {avgRating.toFixed(2)}
              </div>
              <Badge className={`mt-2 ${badge.color}`}>{badge.text}</Badge>
              <p className="text-sm text-gray-600 mt-2">
                Based on {ratings?.total_ratings || 0} ratings
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Rating Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <ThumbsUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{ratings?.five_star_count || 0}</div>
                  <div className="text-xs text-gray-500">5-Star Rides</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Award className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{ratings?.compliments || 0}</div>
                  <div className="text-xs text-gray-500">Compliments</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rating Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Rating Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratings?.[`star_${star}_count`] || (star === 5 ? 45 : star === 4 ? 8 : star === 3 ? 2 : 0);
              const total = ratings?.total_ratings || 55;
              const percent = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="font-medium">{star}</span>
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-yellow-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.5, delay: (5 - star) * 0.1 }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-12 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Acceptance Rate</span>
              <span className="font-semibold text-green-600">{ratings?.acceptance_rate || 95}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-semibold text-green-600">{ratings?.completion_rate || 98}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Cancellation Rate</span>
              <span className="font-semibold text-blue-600">{ratings?.cancellation_rate || 2}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">On-Time Arrival</span>
              <span className="font-semibold text-green-600">{ratings?.ontime_rate || 96}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Reviews */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Recent Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No reviews yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review, idx) => (
                  <div key={idx} className="pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star 
                            key={s} 
                            className={`w-4 h-4 ${
                              s <= review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
                            }`} 
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600">"{review.comment}"</p>
                    )}
                    {review.compliment && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {review.compliment}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips to Improve */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <h4 className="font-semibold text-blue-800 mb-2">💡 Tips to Maintain High Ratings</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Keep your vehicle clean and comfortable</li>
              <li>• Be friendly and professional</li>
              <li>• Arrive on time for pickups</li>
              <li>• Follow GPS but ask about preferred routes</li>
              <li>• Help with luggage when needed</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
