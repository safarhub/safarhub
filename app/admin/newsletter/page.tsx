"use client";
import { useEffect, useState } from "react";
import {
  FaEnvelope,
  FaDownload,
  FaTrash,
  FaCheck,
  FaTimes,
  FaSpinner,
  FaSearch,
} from "react-icons/fa";
import { toast } from "react-hot-toast";

interface Subscriber {
  _id: string;
  email: string;
  isVerified: boolean;
  subscribed: boolean;
  consent: boolean;
  subscribedAt: string;
  unsubscribedAt?: string;
}

export default function NewsletterAdmin() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "pending" | "unsubscribed">(
    "all"
  );
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignHtml, setCampaignHtml] = useState("");
  const [sendingCampaign, setSendingCampaign] = useState(false);

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/newsletter/subscribers", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setSubscribers(data.subscribers);
      } else {
        toast.error(data.message || "Failed to load subscribers");
      }
    } catch (error) {
      toast.error("Error fetching subscribers");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubscribers = subscribers.filter((sub) => {
    const matchesSearch =
      sub.email.toLowerCase().includes(searchQuery.toLowerCase());

    switch (filter) {
      case "verified":
        return matchesSearch && sub.isVerified && sub.subscribed;
      case "pending":
        return matchesSearch && !sub.isVerified;
      case "unsubscribed":
        return matchesSearch && !sub.subscribed;
      default:
        return matchesSearch;
    }
  });

  const deleteSubscriber = async (id: string) => {
    if (!confirm("Delete this subscriber?")) return;

    try {
      const res = await fetch(`/api/admin/newsletter/subscribers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setSubscribers(subscribers.filter((s) => s._id !== id));
        toast.success("Subscriber deleted");
      } else {
        toast.error(data.message || "Failed to delete");
      }
    } catch (error) {
      toast.error("Error deleting subscriber");
    }
  };

  const exportSubscribers = () => {
    const csv = [
      "Email,Verified,Subscribed,Subscribed Date",
      ...filteredSubscribers.map(
        (s) =>
          `"${s.email}",${s.isVerified},${s.subscribed},${new Date(s.subscribedAt).toLocaleString()}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success("Exported successfully");
  };

  const sendCampaign = async () => {
    if (!campaignTitle.trim() || !campaignHtml.trim()) {
      toast.error("Title and content are required");
      return;
    }

    const verifiedCount = filteredSubscribers.filter((s) => s.isVerified && s.subscribed).length;
    if (verifiedCount === 0) {
      toast.error("No verified subscribers to send to");
      return;
    }

    if (!confirm(`Send to ${verifiedCount} subscribers?`)) return;

    try {
      setSendingCampaign(true);
      const res = await fetch("/api/admin/newsletter/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: campaignTitle,
          html: campaignHtml,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Campaign sent to ${data.sentCount} subscribers`);
        setCampaignTitle("");
        setCampaignHtml("");
      } else {
        toast.error(data.message || "Failed to send campaign");
      }
    } catch (error) {
      toast.error("Error sending campaign");
    } finally {
      setSendingCampaign(false);
    }
  };

  const stats = {
    total: subscribers.length,
    verified: subscribers.filter((s) => s.isVerified && s.subscribed).length,
    pending: subscribers.filter((s) => !s.isVerified).length,
    unsubscribed: subscribers.filter((s) => !s.subscribed).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <FaSpinner className="animate-spin text-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Newsletter Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-gray-600 text-sm">Total Subscribers</p>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-gray-600 text-sm">Verified</p>
          <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-gray-600 text-sm">Unsubscribed</p>
          <p className="text-2xl font-bold text-red-600">{stats.unsubscribed}</p>
        </div>
      </div>

      {/* Campaign Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Send Campaign</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              placeholder="Campaign title"
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">HTML Content</label>
            <textarea
              value={campaignHtml}
              onChange={(e) => setCampaignHtml(e.target.value)}
              placeholder="Enter HTML content for the email"
              rows={6}
              className="w-full p-2 border rounded font-mono text-sm"
            />
          </div>
          <button
            onClick={sendCampaign}
            disabled={sendingCampaign}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {sendingCampaign ? <FaSpinner className="animate-spin" /> : <FaEnvelope />}
            {sendingCampaign ? "Sending..." : "Send Campaign"}
          </button>
        </div>
      </div>

      {/* Subscribers Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Subscribers</h2>
          <button
            onClick={exportSubscribers}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <FaDownload /> Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "verified" | "pending" | "unsubscribed")
            }
            className="p-2 border rounded"
          >
            <option value="all">All</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-semibold">Email</th>
                <th className="text-center p-2 font-semibold">Verified</th>
                <th className="text-center p-2 font-semibold">Subscribed</th>
                <th className="text-left p-2 font-semibold">Date</th>
                <th className="text-center p-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-4 text-gray-500">
                    No subscribers found
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((sub) => (
                  <tr key={sub._id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{sub.email}</td>
                    <td className="text-center p-2">
                      {sub.isVerified ? (
                        <FaCheck className="text-green-600 inline" />
                      ) : (
                        <FaTimes className="text-red-600 inline" />
                      )}
                    </td>
                    <td className="text-center p-2">
                      {sub.subscribed ? (
                        <FaCheck className="text-green-600 inline" />
                      ) : (
                        <FaTimes className="text-red-600 inline" />
                      )}
                    </td>
                    <td className="p-2">
                      {new Date(sub.subscribedAt).toLocaleDateString()}
                    </td>
                    <td className="text-center p-2">
                      <button
                        onClick={() => deleteSubscriber(sub._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
